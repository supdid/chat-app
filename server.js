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
// Only trust X-Forwarded-For/X-Forwarded-Proto from a local reverse proxy (a cloudflared quick
// tunnel in front of this process in production, see chat-app-tunnel.service — not nginx, despite
// what an earlier version of this comment claimed) — without this, req.ip (used by
// isAuthRateLimited) resolves to the proxy's own loopback address for every request, collapsing
// every visitor into one shared rate-limit bucket.
app.set('trust proxy', 'loopback');
// Found by a CORS/headers/transport-trust audit: 'trust proxy' above only governs req.ip on
// Express HTTP routes — it has no effect on the raw WebSocket upgrade request (see wss.on
// ('connection', ...) below), which used to trust X-Forwarded-For unconditionally regardless of
// who the immediate TCP peer actually is. This app also listens on all interfaces (server.listen
// below passes no host), so anyone able to reach this machine's IP:PORT directly — bypassing the
// Cloudflare tunnel (chat-app-tunnel.service) entirely — could spoof X-Forwarded-For per
// connection and evade both isWsConnectRateLimited and MAX_SCORPTURE_VIEWERS_PER_IP, both of
// which are keyed on ws._ip. Replicates the same "only trust it from loopback" boundary manually.
function isFromTrustedProxy(remoteAddress) {
  return remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
}
app.disable('x-powered-by'); // no reason to hand out the framework/version for free
const server = http.createServer(app);
// ws defaults to a 100MiB maxPayload when unset — any connected client (getting one just needs an
// open WS connection, no auth) could send a single message up to that size, which the server
// fully buffers and JSON.parses before any of this file's own per-field size checks (e.g.
// bc-block's 2000-change cap, bc-blueprint-save's 20000-block cap) ever get a chance to run. The
// largest legitimate incoming payload is a maximal Build Craft blueprint save (20,000 blocks,
// well under 1MB in practice) — 4MB leaves generous headroom for that while still being a ~25x
// reduction from the default, closing off the bulk of the DoS risk from an oversized frame.
const WS_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
const wss = new WebSocketServer({ server, maxPayload: WS_MAX_PAYLOAD_BYTES });
// Same reasoning as the per-connection ws.on('error', ...) handler further down (see its comment
// for the full unhandled-'error'-event-crashes-the-process mechanism this guards against) — this
// one is at the WebSocketServer level itself, for anything that could go wrong before an
// individual connection even exists (e.g. during the upgrade handshake). Manual testing against a
// scratch server found the specific handshake-malformation cases actually tried degrade gracefully
// on their own (ws responds with a normal HTTP 400, no crash) rather than reaching this — but
// costs nothing to have as defense-in-depth against whatever wasn't tried.
wss.on('error', (err) => {
  // See the matching try/catch on the per-connection ws.on('error', ...) handler further down for
  // why this is wrapped: a failure inside reportError itself (a synchronous DB write) must never
  // become the very crash this handler exists to prevent.
  try {
    reportError('server', err, { wssError: true });
  } catch {
    // Deliberately swallowed.
  }
});
// Found by the WS-connection-liveness audit: there was no heartbeat of any kind, application- or
// OS-level (no socket.setKeepAlive, no server.timeout — and even if there were, HTTP timeouts
// don't apply to a socket already handed off to ws after upgrade). A connection whose peer
// vanishes WITHOUT a clean TCP close (WiFi-to-cellular handoff, a backgrounded mobile browser, an
// elevator) is invisible to this app until the kernel itself eventually errors the socket out —
// 15-30+ minutes on stock Linux (bounded by tcp_retries2, and only IF the server happens to write
// to that socket in the meantime; a truly idle zombie can sit indefinitely). The concrete,
// user-visible cost: several minigames (Firefight, Tic-Tac-Toe/Connect Four, Chess) assign exactly
// two fixed seats per room, freed only from the ws 'close' handler — a zombied duelist's seat stays
// "occupied" until reaped, so a real player reconnecting after a dropped connection lands as a
// spectator in their OWN game with no way to reclaim their seat. Standard ws heartbeat: ping every
// connection on an interval, terminate() (not close() — the whole point is a peer that can't
// complete a clean close) anyone that didn't pong since the last one. terminate() still fires the
// existing 'close' event, so every leaveX() cleanup already wired to it (leaveFg/leaveTt/leaveCh/
// etc., see the close handler further down) runs exactly the same way — no separate cleanup path
// needed. 30s chosen against this app's fastest-moving real-time stream (Firefight's fg-pos, ~10/s)
// — bounds worst-case seat-blocking to under a minute, versus today's 15-30+ minutes or unbounded.
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 30000);
setInterval(() => {
  for (const client of wss.clients) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, HEARTBEAT_INTERVAL_MS);
// Registered this early so every route below — including the self-healing routes, which are
// defined before the rest of the app's routes — can read req.body on POST requests.
app.use(express.json());

// ---- Push notifications (real OS/browser push, delivered even with the tab/app closed —
// unlike the in-tab `Notification` API, which only fires while a page is open). Keys are
// generated once (via `node -e "require('web-push').generateVAPIDKeys()"`) and kept out of
// git since the private key would let anyone impersonate this server to push subscribers.
const vapidKeys = require('./vapid-keys.json');
webpush.setVapidDetails('mailto:admin@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// /push/subscribe and /admin/push/subscribe are both otherwise-unauthenticated (by design — a
// pre-account or non-admin-signed-in browser still needs to be able to subscribe), and previously
// accepted any subscription.endpoint at face value. The web-push library itself does no
// origin-checking either (it just url.parse()s whatever's given and issues an https.request() to
// it) — so an attacker who generates their own valid EC subscription keys (trivial, no browser
// needed) could register an arbitrary internal host:port as their "endpoint" and this server would
// later open an outbound HTTPS connection to it the next time any real push fires. This allowlist
// closes that off at intake; a legitimate browser's PushManager only ever produces an endpoint on
// one of these hosts.
const PUSH_ENDPOINT_ALLOWED_HOSTS = [
  'fcm.googleapis.com', // Chrome/Edge/Android
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari
];
function isValidPushEndpoint(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  return PUSH_ENDPOINT_ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

// The webpush.sendNotification(...).catch(404/410 cleanup) pattern was copy-pasted verbatim at
// every call site that needed it over many sessions — extracted once. onGone defaults to the
// regular per-device subscription table; the admin-notifications path is the one caller that
// passes a different one (db.removeAdminPushSubscription).
function sendPushToSubs(subs, payload, onGone = (endpoint) => db.removePushSubscription(endpoint)) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const sub of subs) {
    webpush.sendNotification(sub.subscription, body).catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) onGone(sub.endpoint);
    });
  }
}

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
  // A ban is meant to cut someone off from a room entirely — without this, a banned person's
  // stale subscription row keeps matching every future message forever, since they can never
  // reconnect to appear in connectedNames. Checked at send time (not deleted on ban) so it also
  // self-heals correctly if they're later unbanned, with no separate restore-on-unban path needed.
  sendPushToSubs(subs.filter((sub) => sub.name !== entry.name && !connectedNames.has(sub.name) && !db.isBannedFromRoom(code, sub.accountId, sub.name)), payload);
}

// Matches an email address typed inline in a chat message, e.g. "jondoe@gmail.com" — used to
// let someone page a specific account holder directly, independent of the normal per-room push
// above (which only reaches people already subscribed *in that room*). A mention push goes to
// every device that account has ever subscribed push on, room or no room, online or offline —
// that's the whole point, per the user's ask ("even when they are offline").
const MENTION_EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function pushMentionNotifications(code, entry, senderAccountId) {
  const emails = entry.text ? entry.text.match(MENTION_EMAIL_RE) : null;
  if (!emails) return;
  const seen = new Set();
  for (const email of emails) {
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Found by an account-recovery/email-flow audit: this used to page EVERY account sharing this
    // email string (db.getAccountsByEmail) — but this app never verifies email ownership at
    // signup, so anyone could register a throwaway account claiming a real person's email address
    // (MAX_ACCOUNTS_PER_EMAIL explicitly permits up to 10 accounts per email) and silently receive
    // a copy of every future "mentioned you" push meant for that address — full message body,
    // room code, forever, with zero interaction from or visibility to the real owner. Narrowed to
    // getAccountByEmail (singular, oldest-created-wins) — the same "pick the one legitimate owner
    // for an ambiguous shared email" resolution already used for Google-sign-in account linking
    // elsewhere in this file. Doesn't require building real email verification, and closes the
    // realistic threat model (an attacker targeting someone who already has an account here); it
    // does not protect a victim who has never signed up here at all under that email, which no
    // fix short of real verification could anyway.
    const account = db.getAccountByEmail(email);
    if (!account) continue;
    // Unlike room chat itself (no ACL beyond the room code), this reaches an account
    // independent of room membership, online status, or having ever been in this room — the
    // same block enforcement every other cross-account push channel (friend-DM, group-DM)
    // already respects, which this one had been missing.
    if (senderAccountId && db.isBlockedBetween(senderAccountId, account.id)) continue;
    const subs = db.getPushSubscriptionsForAccount(account.id);
    if (!subs.length) continue;
    sendPushToSubs(subs, {
      title: `${entry.name} mentioned you`,
      body: entry.text,
      roomCode: code,
      messageId: entry.id,
    });
  }
}

// Pages every device an admin has opted into notifications on (admin.html's "Enable
// notifications" button, see /admin/push/subscribe) the moment a new report is filed — without
// this, a report just sits in /admin.html until someone happens to open the page and check.
function pushAdminOnNewReport(roomCode, reporterName, targetName) {
  const subs = db.getAdminPushSubscriptions();
  if (!subs.length) return;
  sendPushToSubs(subs, {
    title: 'New report',
    body: `${reporterName} reported ${targetName} in room ${roomCode}`,
    adminReport: true,
  }, (endpoint) => db.removeAdminPushSubscription(endpoint));
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
  // If reportError itself throws (a synchronous DB write failing), letting that escape this
  // listener would very likely resurface as another uncaughtException with nothing to distinguish
  // it from a real fatal one — this is meant to stay non-fatal (see the comment above), so a
  // failure to *log* the original error must never escalate it into an exit.
  try {
    reportError('server', err, { fatal: false });
  } catch {
    // Deliberately swallowed.
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Same reasoning as the unhandledRejection handler just above, and even more important here:
  // if reportError itself throws (e.g. a synchronous DB write failing — disk full, locked/
  // corrupted DB), letting that escape a listener already running inside 'uncaughtException'
  // is fatal to Node in an uncontrolled way — it terminates the process immediately without
  // ever reaching process.exit(1) below, skipping the clean, intentional shutdown systemd's
  // Restart=on-failure is built around.
  try {
    reportError('server', err, { fatal: true });
  } catch {
    // Deliberately swallowed — see above.
  }
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
  // The ?key= URL is a one-time bootstrap only — admin.html reads it client-side on first load and
  // saves it to that browser's localStorage, then every actual admin API call goes out as a Bearer
  // header from there on (requireAdmin below no longer accepts the key via query string). Don't
  // bookmark or reuse this URL: unlike localStorage, a bookmark/history entry keeps the plaintext
  // key around indefinitely in a spot that can sync to the cloud if browser sync is enabled.
  console.log(`Admin panel key generated: ${adminKey}\nOpen http://localhost:${process.env.PORT || 3001}/admin.html?key=${adminKey} once to save it into that browser — don't bookmark the URL itself.`);
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
  // Bearer-only: a ?key= query-string fallback used to also be accepted here, but admin.html's own
  // API calls never actually relied on it (it only reads ?key= client-side once, to seed
  // localStorage — see the boot-log comment above), and a query string is a materially weaker place
  // for a permanent, non-rotating credential to live — it lands in server access logs and any
  // Referer header a linked-out page might send, neither of which localStorage-via-header does.
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const tokenBuf = Buffer.from(token);
  const keyBuf = Buffer.from(adminKey);
  if (!token || tokenBuf.length !== keyBuf.length || !crypto.timingSafeEqual(tokenBuf, keyBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Public — clients report their own uncaught errors here (window.onerror / unhandledrejection).
app.post('/errors/report', (req, res) => {
  if (isErrorReportRateLimited(req)) return res.status(429).json({ error: 'Too many reports too quickly' });
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

// setErrorReportStatus already existed in db.js (used nowhere until now) but had no route —
// admin.html's error list had no resolve/dismiss action at all, unlike the reports panel right
// next to it, so a fixed error just sat there forever on every future page load with no way to
// clear it out of the list.
app.post('/admin/errors/:id/resolve', requireAdmin, (req, res) => {
  db.setErrorReportStatus(req.params.id, 'resolved');
  res.json({ ok: true });
});

app.post('/admin/errors/:id/dismiss', requireAdmin, (req, res) => {
  db.setErrorReportStatus(req.params.id, 'dismissed');
  res.json({ ok: true });
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
  // deleteScorptureVideo() never cleaned up scorpture_reports (unlike comments/likes, which it
  // does) — a report for a video that's since been deleted (including by the reported uploader
  // themselves, right after being reported) used to look identical to one for a still-live video,
  // with no way for the admin to tell the difference. videoDeleted lets admin.html show that.
  const reports = db.getRecentScorptureReports().map((r) => ({ ...r, videoDeleted: !db.getScorptureVideo(r.video_id) }));
  res.json({ reports });
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
  if (!isValidPushEndpoint(subscription.endpoint)) {
    return res.status(400).json({ error: 'Invalid subscription endpoint' });
  }
  db.addAdminPushSubscription(subscription.endpoint, subscription);
  res.json({ ok: true });
});

app.post('/admin/push/unsubscribe', requireAdmin, (req, res) => {
  const endpoint = req.body.endpoint;
  if (endpoint) db.removeAdminPushSubscription(endpoint);
  res.json({ ok: true });
});

app.get('/admin/patches', requireAdmin, (req, res) => {
  const patches = db.getPendingPatchProposals().map((p) => ({
    ...p,
    touchesAuthSensitiveCode: patcher.touchesAuthSensitiveCode(p),
  }));
  res.json({ patches });
});

// This app runs as more than one deployed copy on the same machine, each its own systemd user
// service (chat-app itself on 3001, plus chat-app-dev on 3005 and chat-app-test on 3007 — see
// their .service files) — 'chat-app' was hardcoded here regardless of which copy was actually
// running it. Approving a self-patch on the dev or test sandbox would restart *production*
// instead of the sandbox that actually owns the change: the sandbox's own patched file never
// takes effect (its still-running old process is untouched), and production gets an unplanned,
// unrelated restart. SYSTEMD_SERVICE_NAME is unset in production, so this defaults to the exact
// previous behavior there; each sandbox's .service file should set it to its own unit name.
const SYSTEMD_SERVICE_NAME = process.env.SYSTEMD_SERVICE_NAME || 'chat-app';
app.post('/admin/patches/:id/approve', requireAdmin, (req, res) => {
  try {
    const result = patcher.applyProposal(req.params.id);
    res.json({ ok: true, ...result });
    if (result.restarted) {
      setTimeout(() => {
        exec(`systemctl --user restart ${SYSTEMD_SERVICE_NAME}`, (err) => {
          if (err) console.error('[patcher] Restart failed:', err.message);
        });
      }, 500);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/admin/patches/:id/reject', requireAdmin, (req, res) => {
  const changed = db.setPatchProposalStatus(req.params.id, 'rejected');
  if (!changed) return res.status(400).json({ error: 'Proposal not found or already decided' });
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
    // Found by a file-upload storage audit: every other security-relevant identifier in this app
    // (session tokens, message/account ids, the admin key) uses crypto.randomUUID()/randomBytes —
    // this was the one place still using Math.random(), which is not cryptographically secure.
    // Not a practically exploitable hole today (uploaded files aren't otherwise access-controlled
    // by anything except this same unguessability, and 128 bits from randomBytes is a large step
    // up from Math.random()'s ~52), but there's no reason for this one path to be the weak link.
    cb(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${SAFE_UPLOAD_EXT[baseMimeType(file.mimetype)] || ''}`);
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

// Defense-in-depth for /uploads: the upload filter already derives the saved extension from a
// fixed mimetype map rather than trusting the client (see SAFE_UPLOAD_EXT above), so this isn't
// closing a live hole through the UI itself — but nosniff stops a browser from ever second-
// guessing a served file's declared Content-Type based on its bytes, which is the standard
// defense against a crafted direct request landing a mismatched file in /uploads/.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // This app never frames itself, and there are real single-click state-changing actions —
  // including the admin panel, whose auth token lives in this origin's own localStorage and would
  // still be reachable from inside a same-origin iframe an admin was tricked into clicking through.
  res.setHeader('X-Frame-Options', 'DENY');
  // Deliberately narrow for now: a real script-src policy needs nonces/hashes for the four pages
  // with an inline <script> block (admin/aistudio/index/videoeditor.html), which is a bigger,
  // separate rollout. frame-ancestors/object-src are safe to add immediately regardless of that,
  // and frame-ancestors is the modern (CSP) equivalent of X-Frame-Options above, kept alongside it
  // since older browsers only honor the header form.
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'");
  // Quick-tunnel hostnames rotate on every restart (see chat-app-tunnel.service), so HSTS's
  // host-pinning barely applies here, but it's still correct to send when a request genuinely
  // arrived over HTTPS — trust proxy is scoped to 'loopback' above, so req.secure only reflects a
  // real X-Forwarded-Proto from the tunnel process itself, never an arbitrary client-supplied
  // header — and it's skipped otherwise, since plain-HTTP localhost/LAN access is a real, intended
  // way to reach this app, not something to coerce into HTTPS.
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  // Found by a CORS/headers/transport-trust audit: cheap to add, no functionality depends on
  // either being absent. same-origin keeps the Referer header on same-origin navigation (this app
  // does have internal links between pages) but never leaks it to an external site. The
  // Permissions-Policy list is deliberately unused-features-only — camera/microphone are real,
  // in-use features here (voice calls, Scorpture streaming) and are left unrestricted (their
  // browser-default is already 'self', i.e. only this origin, so there's nothing to tighten
  // without risking breaking them).
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// The WS join-room handler is the only place that used to check a room's PIN — these four plain
// HTTP routes (below) could read or post into a PIN-protected room without ever supplying it.
// Shared here so all four check it the same way join-room already does (join-room itself was
// switched to call this too — see its own comment — so the check now has exactly one implementation).
function roomPinOk(dbRoom, suppliedPin) {
  if (!dbRoom || !dbRoom.pin_required) return true;
  // Same reasoning as verifyPassword/requireAdmin's use of timingSafeEqual — a naive === here would
  // let a remote attacker's response-time samples leak how many leading characters of a guessed PIN
  // were correct. Lower-severity than those two (this feature is explicitly documented elsewhere as
  // "not real security," and every reachable call site is now rate-limited), but a PIN's low entropy
  // relative to a randomUUID session token makes it the more realistic timing-attack target of the
  // two, so it's still worth the same one-line fix rather than leaving the one gap in an otherwise
  // consistently-applied pattern.
  const supplied = Buffer.from(String(suppliedPin || '').trim());
  const real = Buffer.from(dbRoom.pin_required);
  return supplied.length === real.length && crypto.timingSafeEqual(supplied, real);
}

// A message row's account_id (see insertMessage) is a much sturdier ownership check than its
// display name when it's set — names have no persistent identity, so someone who reconnects
// under a name a signed-in account previously posted under could otherwise edit/delete that
// account's messages just by matching the name. Anonymous messages (account_id null) fall back
// to the original name-only check, unchanged.
function ownsMessage(target, ws) {
  if (target.account_id) return target.account_id === ws.accountId;
  return target.name === ws.profile.name;
}

// Lets the AI Studio page (its own tab, no live WebSocket/presence session) drop a
// generated image into a room's chat without going through the join-server/join-room
// flow — which would spuriously fire "X joined the room" for a tab that isn't really
// sitting in the room.
app.post('/post-image', (req, res) => {
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many posts too quickly — slow down a bit.' });
  const code = String(req.body.code || '').toUpperCase().trim();
  const name = String(req.body.name || 'Someone').slice(0, 30).trim() || 'Someone';
  // Every other "attach media" path in this app (the WS 'message' handler, /post-media below,
  // scorpture uploads) requires a real /uploads/ URL, closing off arbitrary external URLs that'd
  // auto-load in every room member's browser as a classic IP/UA-grabbing tracker link. AI Studio's
  // own uncaptioned-image flow legitimately posts a direct image.pollinations.ai URL (only
  // captioned memes get uploaded first) — that's the one external host allowed here.
  const rawMediaUrl = typeof req.body.mediaUrl === 'string' ? req.body.mediaUrl.slice(0, 2000) : null;
  const mediaUrl = rawMediaUrl && (rawMediaUrl.startsWith('/uploads/') || rawMediaUrl.startsWith('https://image.pollinations.ai/'))
    ? rawMediaUrl
    : null;
  const prompt = String(req.body.prompt || '').slice(0, 500).trim();
  if (!code || !mediaUrl) return res.status(400).json({ error: 'Missing room code or image' });
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  // Unlike the WS 'message'/'join-room' paths, this route has no live session to gate on — a
  // banned/muted user could otherwise keep posting images into a room forever just by hitting
  // this endpoint directly, bypassing moderation entirely.
  const postImageAccount = getAccountFromReq(req);
  if (db.isBannedFromRoom(code, postImageAccount ? postImageAccount.id : null, name)) {
    return res.status(403).json({ error: "You've been banned from this room" });
  }
  if (room.muted && room.muted.has(name)) {
    return res.status(403).json({ error: 'You have been muted in this room' });
  }
  if (!roomPinOk(db.getRoom(code), req.body.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });
  // Claimed only once every rejection above has already passed, not the moment the URL is parsed
  // — a muted/banned user (or a stale room/PIN) is a routine, not just theoretical, way to hit one
  // of those returns with a perfectly real, just-uploaded file already sitting in mediaUrl; claiming
  // it before this point would have exempted it from the sweep for good, orphaning it on disk with
  // no path left to ever clean it up (the exact "orphaned Scorpture-style upload" gap this app has
  // flagged and deferred before — this is the same shape and finally gets it right).
  claimUpload(mediaUrl);

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
  db.insertMessage({ id: entry.id, roomCode: code, name: entry.name, text: entry.text, mediaUrl: entry.mediaUrl, mediaType: entry.mediaType, at: entry.at, accountId: postImageAccount ? postImageAccount.id : null });
  db.upsertRoom(code);
  broadcastRoom(code, entry);
  pushNewMessage(code, entry);
  res.json({ ok: true });
});

// Same "own tab, no live WebSocket session" case as /post-image, but generic over
// mediaType so the Video Editor can drop a finished render into the room's chat.
app.post('/post-media', (req, res) => {
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many posts too quickly — slow down a bit.' });
  const code = String(req.body.code || '').toUpperCase().trim();
  const name = String(req.body.name || 'Someone').slice(0, 30).trim() || 'Someone';
  // Same tracker-link concern as /post-image above — this route's only real client (Video
  // Editor's "Send to chat") always uploads first and passes a real /uploads/ URL, so no
  // external-host exception is needed here.
  const rawMediaUrl = typeof req.body.mediaUrl === 'string' ? req.body.mediaUrl.slice(0, 2000) : null;
  const mediaUrl = rawMediaUrl && rawMediaUrl.startsWith('/uploads/') ? rawMediaUrl : null;
  const mediaType = ['video', 'image', 'audio'].includes(req.body.mediaType) ? req.body.mediaType : null;
  const caption = String(req.body.caption || '').slice(0, 500).trim();
  if (!code || !mediaUrl || !mediaType) return res.status(400).json({ error: 'Missing room code or media' });
  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  // Same moderation-bypass concern as /post-image above — this route also has no live WS
  // session to check ban/mute status on otherwise.
  const postMediaAccount = getAccountFromReq(req);
  if (db.isBannedFromRoom(code, postMediaAccount ? postMediaAccount.id : null, name)) {
    return res.status(403).json({ error: "You've been banned from this room" });
  }
  if (room.muted && room.muted.has(name)) {
    return res.status(403).json({ error: 'You have been muted in this room' });
  }
  if (!roomPinOk(db.getRoom(code), req.body.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });
  // Claimed only after every rejection above — see the identical fix (and its full explanation)
  // on /post-image just above.
  claimUpload(mediaUrl);

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
  db.insertMessage({ id: entry.id, roomCode: code, name: entry.name, text: entry.text, mediaUrl: entry.mediaUrl, mediaType: entry.mediaType, at: entry.at, accountId: postMediaAccount ? postMediaAccount.id : null });
  db.upsertRoom(code);
  broadcastRoom(code, entry);
  pushNewMessage(code, entry);
  res.json({ ok: true });
});

// Full-history search (unlike the 50-message in-memory window) — this is why SQLite
// persistence was built first, since search over just the last 50 messages wouldn't
// be very useful.
app.post('/search', (req, res) => {
  // No throttle at all before this — real DB query cost per call, and (like /export below) an
  // oracle for brute-forcing a PIN-protected room's PIN if the code is already known. The PIN
  // check itself is documented elsewhere as "not real security", but a rate limit still raises
  // the practical cost of automated guessing for free, same as every other content route in this
  // file that got this treatment.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many requests too quickly' });
  const body = req.body || {};
  const code = String(body.code || '').toUpperCase().trim();
  const q = String(body.q || '').trim();
  if (!code || !q) return res.json({ results: [] });
  const dbRoom = db.getRoom(code);
  if (!rooms.has(code) && !dbRoom) return res.status(404).json({ error: 'Room not found' });
  // Same "no live WS session to check ban status on" fix as /export just below — found by the
  // same room-export-authorization audit, which flagged this route as having the identical gap.
  const searchAccount = getAccountFromReq(req);
  const searchName = String(body.name || '').slice(0, 30).trim();
  if (db.isBannedFromRoom(code, searchAccount ? searchAccount.id : null, searchName)) {
    return res.status(403).json({ error: "You've been banned from this room" });
  }
  if (!roomPinOk(dbRoom, body.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });
  res.json({ results: db.searchMessages(code, q, 50) });
});

// Plain-text transcript download — reuses the same room-existence check as /search,
// and reads full history from SQLite rather than the in-memory 50-message window.
// POST, not GET — a room PIN traveling in a query string (the old /export?code=&pin= shape)
// leaks into browser history and any Referer header, same concern already fixed for /search.
// Kept as a real download (Content-Disposition), just reached via fetch()+blob from the client
// now instead of a plain <a href> navigation, since a GET-only <a> can't carry a POST body.
app.post('/export', (req, res) => {
  // Same PIN-oracle/no-throttle reasoning as /search above — this one also dumps a room's entire
  // message history per call, real DB read cost on top of the PIN-guessing concern.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many requests too quickly' });
  const code = String(req.body.code || '').toUpperCase().trim();
  const dbRoom = db.getRoom(code);
  if (!code || (!rooms.has(code) && !dbRoom)) return res.status(404).json({ error: 'Room not found' });
  // Same "no live WS session to check ban status on" shape /post-image and /post-media already
  // solve — this route had neither the check nor even the identity fields needed to run one,
  // found by a room-export-authorization audit. A banned user could otherwise still pull a
  // room's entire message history through this side door.
  const exportAccount = getAccountFromReq(req);
  const exportName = String(req.body.name || '').slice(0, 30).trim();
  if (db.isBannedFromRoom(code, exportAccount ? exportAccount.id : null, exportName)) {
    return res.status(403).json({ error: "You've been banned from this room" });
  }
  if (!roomPinOk(dbRoom, req.body.pin)) return res.status(403).json({ error: 'Incorrect or missing room PIN' });
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
  // Unlike every other content-serving route in this file, this had no throttle at all — cheap
  // per call, but still a real CPU-amplification vector for anyone who already knows one valid
  // room code (repeated requests to a fixed URL are trivial to script). Same shared per-IP gate
  // every other previously-unprotected route this session got.
  if (isPostMediaRateLimited(req)) return res.status(429).end();
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
// Every other cache/rate-limit Map in this file (authRateLimits, usernameFailLimits,
// postMediaRateLimits, errorReportRateLimits, friendsActionRateLimits, wsConnectRateLimits,
// pendingUploads) caps its worst-case size the same crude way — this one was missing it. Unlike
// those, this cache is keyed by an arbitrary caller-supplied URL string rather than an IP, so the
// existing per-IP rate limit on /link-preview doesn't bound the number of distinct keys at all:
// one IP pasting many different URLs over time (or an attacker doing it deliberately) could grow
// this Map without limit, since expired entries are only skipped on read, never actively evicted.
function cacheLinkPreview(url, entry) {
  linkPreviewCache.set(url, entry);
  if (linkPreviewCache.size > 10000) linkPreviewCache.clear();
}

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
  // Unlike every other route that reaches out to a client-chosen resource, this had no throttle
  // at all — worse than most, since it's not just cheap-per-call like /room-qr: this makes the
  // SERVER issue an outbound fetch (up to 5s) to a URL of the caller's choosing, unauthenticated,
  // no prior knowledge needed (no room code, no anything). Varying the URL bypasses the existing
  // per-URL cache entirely, so an attacker could turn this into an open outbound-request relay or
  // just tie up server resources with many concurrent slow fetches. Same shared per-IP gate.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many requests too quickly' });
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
      cacheLinkPreview(url, { data: empty, expiresAt: Date.now() + LINK_PREVIEW_TTL_MS });
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
    cacheLinkPreview(url, { data, expiresAt: Date.now() + LINK_PREVIEW_TTL_MS });
    res.json(data);
  } catch {
    cacheLinkPreview(url, { data: empty, expiresAt: Date.now() + LINK_PREVIEW_FAILURE_TTL_MS });
    res.json(empty);
  }
});

// Built from the actual files on disk (rather than duplicating public/stickers.js's list here)
// so the two can't silently drift — a sticker added to one and not the other would otherwise
// either 404 in the picker or get rejected below with no error, the same "one list missed a
// mediaUrl format" shape as the /uploads/ prefix checks elsewhere in this file.
const STICKER_URLS = new Set(
  fs.readdirSync(path.join(__dirname, 'public/images/stickers')).map((f) => `/images/stickers/${f}`)
);

// /upload is the single shared, public, unauthenticated endpoint every "attach media" feature in
// this app funnels through — but nothing ever required the returned URL to actually get used for
// anything. A file uploaded and never attached to a message/video/avatar/etc. was invisible to
// cleanupInactiveRooms below (which only ever finds files by walking messages/videos that
// reference them) and lived on disk forever, with no size quota anywhere: an anonymous script
// hitting POST /upload in a loop — rate-limited to 8 requests/6s, but each one can be up to the
// existing 300MB cap — could fill this app's disk in minutes from a single IP with zero login and
// zero further action. Tracks every upload's URL + timestamp; claimUpload() (called from every
// route below that actually persists a client-supplied /uploads/ URL somewhere real) removes the
// entry, and sweepOrphanedUploads() near cleanupInactiveRooms deletes anything still unclaimed
// after a generous grace period. In-memory only (resets on restart) — same "simple bound, not
// perfect accounting" tradeoff this file's other in-memory rate-limit maps already make; the
// worst case on a restart is a handful of pre-restart orphans going unswept, not a new hole.
const pendingUploads = new Map(); // url -> uploadedAt
function claimUpload(url) {
  if (typeof url === 'string') pendingUploads.delete(url);
}

app.post('/upload', (req, res) => {
  // Unlike every other HTTP room-content route, this had zero throttling and needs no auth/room
  // membership — a scripted burst (up to the existing 300MB-per-file cap, no login required)
  // could fill disk fast. Checked before multer touches the request so a rate-limited call never
  // even gets as far as writing a file to disk.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many uploads too quickly — slow down a bit.' });
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const mediaType = req.file.mimetype.startsWith('video/')
      ? 'video'
      : req.file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'image';
    const url = `/uploads/${req.file.filename}`;
    pendingUploads.set(url, Date.now());
    // Same crude bound every other in-memory rate-limit Map in this file already has — normal
    // use never comes close (each upload is itself rate-limited, and every entry is removed
    // within a grace+sweep-interval window at most), but a large-scale sustained attack from many
    // distinct IPs could otherwise grow this unboundedly between sweeps. Clearing wholesale rather
    // than partially evicting "fails open" (some currently-pending uploads lose tracking and
    // become un-sweepable, i.e. safe by accident) rather than risking a more complex eviction bug.
    if (pendingUploads.size > 10000) pendingUploads.clear();
    res.json({ url, mediaType });
  });
});

// Lets a client keep an uploaded file alive without ever attaching it to a message/video/avatar/
// etc. — needed for AI Studio's gallery, which is entirely client-side (localStorage, no server
// row at all) and explicitly meant to keep a captioned meme's uploaded composite around
// indefinitely (it has its own "remove from gallery" control, so it's a real managed collection,
// not a throwaway). Without this, a gallery-only image (generated, kept locally, never posted to
// a room) would silently 404 once sweepOrphanedUploads caught up to it — a real regression this
// endpoint exists specifically to prevent. Harmless to call on a URL that was never pending (a
// raw Pollinations.ai URL, or one already claimed) — claimUpload no-ops either way.
app.post('/claim-upload', (req, res) => {
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many requests too quickly' });
  const url = typeof req.body.url === 'string' ? req.body.url.slice(0, 500) : '';
  if (url.startsWith('/uploads/')) claimUpload(url);
  res.json({ ok: true });
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
  // Unauthenticated (works with no account) row-creating route with no throttle — each call
  // upserts a push_subscriptions row, an unbounded-growth vector otherwise unlike the toggle/
  // single-row-per-account routes elsewhere in this file.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many requests too quickly' });
  const roomCode = String(req.body.roomCode || '').toUpperCase().trim();
  const name = String(req.body.name || '').slice(0, 30).trim();
  const subscription = req.body.subscription;
  if (!name || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing name or subscription' });
  }
  if (!isValidPushEndpoint(subscription.endpoint)) {
    return res.status(400).json({ error: 'Invalid subscription endpoint' });
  }
  const account = getAccountFromReq(req);
  db.savePushSubscription(roomCode || null, name, subscription, account ? account.id : null);
  res.json({ ok: true });
});

app.post('/push/unsubscribe', (req, res) => {
  // Its sibling /push/subscribe just above already has this — unauthenticated, no ownership
  // check on the endpoint (not really meaningful here; endpoints are long random push-service
  // URLs, not guessable), but still an unthrottled DB query on every call with no gate at all.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many requests too quickly' });
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

// isAuthRateLimited above only throttles per-IP — a distributed attacker (many IPs/a botnet) can
// brute-force one specific account's password at unlimited aggregate rate with that alone, since
// nothing tracks failures *per account*. This does, but deliberately doesn't fully lock the
// account out at the threshold — an attacker could otherwise cheaply deny a real user service
// just by feeding wrong passwords for their username from anywhere, with no password of their own
// needed. A generous threshold instead: only kicks in under genuine sustained/distributed brute-
// forcing, never affects a real user who fat-fingers their password a few times. Only failed
// attempts count — a successful login never touches this.
const usernameFailLimits = new Map();
const USERNAME_FAIL_WINDOW_MS = 10 * 60 * 1000;
// Overridable via env, same as the upload-sweep timers above, so the regression suite can verify
// this fires without needing 20 real requests (which would trip the stricter per-IP auth limiter
// first, since every test request comes from the same IP). Unset in production, no effect there.
// `?? ` (not `||`) on every env-overridable constant below and elsewhere in this file — found by
// a sweep for this exact footgun (already independently discovered and fixed once for
// FG_RESPAWN_GRACE_MS/BB_RESPAWN_GRACE_MS above: `Number(process.env.X) || default` silently
// ignores a real, intentional `X=0` override, since 0 is falsy). None of these currently have a
// test that needs a literal 0, so this was latent, not live — fixed anyway since it's a one-token
// change with zero behavior difference for every value except 0/unset, closing off the same class
// of bug before it bites a future test the way it already did for the two constants above.
const USERNAME_FAIL_MAX = Number(process.env.USERNAME_FAIL_MAX ?? 20);
function isUsernameFailRateLimited(username) {
  const key = username.toLowerCase();
  const now = Date.now();
  const timestamps = (usernameFailLimits.get(key) || []).filter((t) => now - t < USERNAME_FAIL_WINDOW_MS);
  return timestamps.length >= USERNAME_FAIL_MAX;
}
function recordUsernameFail(username) {
  const key = username.toLowerCase();
  const now = Date.now();
  const timestamps = (usernameFailLimits.get(key) || []).filter((t) => now - t < USERNAME_FAIL_WINDOW_MS);
  timestamps.push(now);
  usernameFailLimits.set(key, timestamps);
  if (usernameFailLimits.size > 10000) usernameFailLimits.clear(); // crude bound on worst-case memory, same pattern as authRateLimits
}

// /post-image and /post-media are the only two ways to create a chat message that don't go
// through a WebSocket connection (AI Studio / Video Editor posting from their own tab), so they
// never hit the ws.msgTimestamps flood gate every other message-creation path shares (see
// RATE_LIMIT_WINDOW_MS/RATE_LIMIT_MAX_MESSAGES below, and the 'send-group-dm'/'scorpture-live-chat'
// fixes earlier tonight that closed the same gap elsewhere) — each call is a synchronous DB write
// plus a room-wide broadcast plus a push notification to every offline subscriber, all
// unthrottled otherwise. Same per-IP Map pattern as isAuthRateLimited above.
const postMediaRateLimits = new Map();
function isPostMediaRateLimited(req) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const timestamps = (postMediaRateLimits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    postMediaRateLimits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  postMediaRateLimits.set(ip, timestamps);
  if (postMediaRateLimits.size > 10000) postMediaRateLimits.clear();
  return false;
}

// /errors/report is public/unauthenticated by necessity (anonymous clients need to report their
// own errors) — unlike every other public route, though, it had no rate limit at all, and a
// message/stack/url that resolves to a real source file triggers a real (billed) Anthropic API
// call in patcher.js. Without this, a scripted loop could both run up real API cost and spam
// attacker-authored text into the self-healing pipeline's prompt at unlimited speed. Same
// per-IP Map pattern as the limiters above, just its own bucket/window.
const errorReportRateLimits = new Map();
const ERROR_REPORT_WINDOW_MS = 60000;
const ERROR_REPORT_MAX = 10; // generous for a real client hitting several distinct bugs in a minute
function isErrorReportRateLimited(req) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const timestamps = (errorReportRateLimits.get(ip) || []).filter((t) => now - t < ERROR_REPORT_WINDOW_MS);
  if (timestamps.length >= ERROR_REPORT_MAX) {
    errorReportRateLimits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  errorReportRateLimits.set(ip, timestamps);
  if (errorReportRateLimits.size > 10000) errorReportRateLimits.clear();
  return false;
}

// /friends/* actions require a signed-in account but were otherwise unthrottled — unlike
// /auth/signup itself, accounts are cheap and self-service, so this was still reachable at full
// speed. Each 404-vs-non-404 response is also a fast username-enumeration oracle; this doesn't
// close that (would need a uniform response either way, a bigger behavior change), just stops it
// from being queried at unlimited speed. Same per-IP Map pattern as the limiters above.
const friendsActionRateLimits = new Map();
const FRIENDS_ACTION_WINDOW_MS = 60000;
const FRIENDS_ACTION_MAX = Number(process.env.FRIENDS_ACTION_MAX ?? 20);
function isFriendsActionRateLimited(req) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const timestamps = (friendsActionRateLimits.get(ip) || []).filter((t) => now - t < FRIENDS_ACTION_WINDOW_MS);
  if (timestamps.length >= FRIENDS_ACTION_MAX) {
    friendsActionRateLimits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  friendsActionRateLimits.set(ip, timestamps);
  if (friendsActionRateLimits.size > 10000) friendsActionRateLimits.clear();
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
  if (username && isUsernameFailRateLimited(username)) {
    return res.status(429).json({ error: 'Too many attempts — try again in a few minutes' });
  }
  const account = db.getAccountByUsername(username);
  if (!account || !verifyPassword(password, account.salt, account.password_hash)) {
    if (username) recordUsernameFail(username);
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
  // Its siblings /auth/signup and /auth/login both share this same gate — this route does real
  // cryptographic verification work (verifyIdToken) per call and had no throttle of its own,
  // inconsistent with the rest of the auth surface.
  if (isAuthRateLimited(req)) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
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
  // verifyIdToken only proves the token was really issued by Google for this app — it does NOT
  // mean Google itself has confirmed the holder controls this email address (Google's own
  // documented guidance is that callers must check email_verified themselves before trusting the
  // address for anything security-sensitive). Without this check, an attacker who can obtain a
  // legitimately-signed token carrying an unverified victim email (possible via some federated-
  // IdP-backed or admin-provisioned Google accounts) could get it silently linked to the victim's
  // existing password account below — full account takeover, no password needed.
  const email = payload.email_verified ? payload.email || null : null;

  let account = db.getAccountByGoogleId(googleId);
  if (!account && email) {
    // Someone who already has a password account under this email — link rather than duplicate.
    // Found by a Google-linking-security audit: only safe to auto-link when that existing
    // account has NO password set and NO Google identity already linked. This app's /auth/signup
    // never verifies email ownership (anyone can sign up claiming any address), so an attacker
    // could pre-register the victim's real email with an attacker-chosen password — a later
    // genuine Google sign-in for that email must NOT silently bind onto that account, or the
    // attacker keeps permanent access via their own known password (full account takeover, no
    // credential of the victim's needed). Similarly, an account that already has a DIFFERENT
    // google_id linked must not be silently reassigned (email reuse after a real identity
    // change, e.g. an employer handing an old mailbox to a new hire, would hijack the PREVIOUS
    // Google user's account). Either way, "not safely claimable" falls through to creating a
    // brand-new account for this Google identity below, instead of merging into someone else's.
    const existing = db.getAccountByEmail(email);
    if (existing && !existing.password_hash && !existing.google_id) {
      db.linkGoogleId(existing.id, googleId);
      account = db.getAccountById(existing.id);
    }
  }
  if (!account) {
    const id = crypto.randomUUID();
    const username = uniqueUsernameFrom(payload.name || (email ? email.split('@')[0] : 'user'));
    try {
      db.createAccountWithGoogle(id, username, email, googleId);
      account = db.getAccountById(id);
    } catch (err) {
      // Two tabs finishing Google sign-in for the same brand-new account at once can both pass the
      // "no existing account" checks above before either insert lands — the DB's own UNIQUE index
      // on google_id (see db.js) is what actually closes the race, but nothing here used to catch
      // that constraint violation, so the losing request fell through to Express's generic 500
      // instead of completing sign-in the way the winner did. Re-checking here turns "the second
      // tab silently fails to log in" into "both tabs end up signed in to the same account" — the
      // actually-correct outcome for two concurrent submissions of the same credential.
      account = db.getAccountByGoogleId(googleId);
      if (!account) return res.status(500).json({ error: 'Could not complete sign-in — try again' });
    }
  }

  const token = crypto.randomUUID();
  db.createSession(token, account.id);
  res.json({ token, username: account.username });
});

app.post('/auth/logout', (req, res) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  // "everywhere" mode: found by a credential-change-security audit — this used to only ever be
  // able to kill the single token the caller already holds, giving a user no way to respond to a
  // leaked/stolen token for their own account (the only alternative, a password change, didn't
  // exist as a route at all until the fix alongside this one). Resolves the account from the
  // presented token first so an arbitrary/forged accountId in the body can't be used to log
  // someone else out.
  if (req.body && req.body.everywhere && token) {
    const account = db.getSessionAccount(token);
    if (account) {
      db.deleteSessionsForAccount(account.id);
      return res.json({ ok: true });
    }
  }
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
  // Found by a credential-change-security audit: this was the one /account/* mutation with no
  // rate limit at all — reusing isAuthRateLimited since it's the same "authenticated but still
  // shouldn't be hammerable" profile (a username-taken 409 is a token-gated but still unbounded
  // enumeration oracle without this).
  if (isAuthRateLimited(req)) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
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

// Found by the same audit as the fixes above: there was no way to change a password at all,
// meaning a leaked/stolen session token was a permanent, unrecoverable full account takeover —
// the real owner had no in-app way to invalidate it. Requires the current password (same
// verifyPassword call login itself uses), then invalidates every OTHER session for this account
// so a stolen token stops working the moment the real owner notices and changes their password —
// a fresh token is minted so the tab/device that just made this request stays signed in.
app.post('/account/password', (req, res) => {
  if (isAuthRateLimited(req)) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  if (!account.password_hash) {
    return res.status(400).json({ error: 'This account signed in with Google and has no password to change' });
  }
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!verifyPassword(currentPassword, account.salt, account.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.updateAccountPassword(account.id, hashPassword(newPassword, salt), salt);
  db.deleteSessionsForAccount(account.id);
  const token = crypto.randomUUID();
  db.createSession(token, account.id);
  res.json({ token });
});

// ---- Friends (account-only — an anonymous per-room display name isn't a stable enough
// identity to hang a friends list off of) ----

app.get('/friends', (req, res) => {
  // Found by a friends/DM authorization audit: every /friends/* mutation route (and the separate
  // /friends/presence, which got its own copy of this same limiter — see its comment) is
  // rate-limited, but this base listing route (3 DB queries: friends+incoming+outgoing+blocked)
  // was left out. No cross-account exposure either way — just closing the one gap in an otherwise
  // consistently-limited route family.
  if (isFriendsActionRateLimited(req)) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  res.json({
    friends: db.getFriends(account.id),
    incoming: db.getIncomingFriendRequests(account.id),
    outgoing: db.getOutgoingFriendRequests(account.id),
    blocked: db.getBlockedUsers(account.id),
  });
});

// Rate-limit + auth + target-lookup preamble shared by every /friends/* action below (request,
// accept, remove, block, unblock) — was copy-pasted verbatim at all five call sites. Sends the
// appropriate error response itself and returns null when any check fails, so callers just do
// `const r = resolveFriendsAction(req, res); if (!r) return;`.
function resolveFriendsAction(req, res) {
  if (isFriendsActionRateLimited(req)) {
    res.status(429).json({ error: 'Too many attempts — try again in a minute' });
    return null;
  }
  const account = getAccountFromReq(req);
  if (!account) {
    res.status(401).json({ error: 'Not signed in' });
    return null;
  }
  const target = db.getAccountByUsername(String(req.body.username || '').trim());
  if (!target) {
    res.status(404).json({ error: 'No account with that username' });
    return null;
  }
  return { account, target };
}

app.post('/friends/request', (req, res) => {
  const r = resolveFriendsAction(req, res);
  if (!r) return;
  const { account, target } = r;
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
  const r = resolveFriendsAction(req, res);
  if (!r) return;
  const { account, target } = r;
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
  const r = resolveFriendsAction(req, res);
  if (!r) return;
  const { account, target } = r;
  db.removeFriendship(account.id, target.id);
  res.json({ ok: true });
});

app.post('/friends/block', (req, res) => {
  const r = resolveFriendsAction(req, res);
  if (!r) return;
  const { account, target } = r;
  if (target.id === account.id) return res.status(400).json({ error: "You can't block yourself" });
  db.setBlocked(account.id, target.id);
  res.json({ ok: true });
});

app.post('/friends/unblock', (req, res) => {
  const r = resolveFriendsAction(req, res);
  if (!r) return;
  const { account, target } = r;
  db.unblock(account.id, target.id);
  res.json({ ok: true });
});

app.get('/friends/presence', (req, res) => {
  // Every other /friends/* route rate-limits via resolveFriendsAction — this one bypasses that
  // shared preamble (it doesn't take a target username, so most of resolveFriendsAction doesn't
  // apply) and was left with no rate limit at all as a result. Found by a presence-exposure
  // audit — not reachable against arbitrary accounts (the target list only ever comes from the
  // caller's own db.getFriends, never client input), but nothing stopped a friend from polling
  // far faster than the real client's own 8s interval to build a higher-resolution room-hopping
  // log of another friend than the UI intends.
  if (isFriendsActionRateLimited(req)) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  // getFriends already JOINs accounts for the username — it now also selects the id directly,
  // so this no longer needs a second getAccountByUsername lookup per friend (an N+1 that ran on
  // every 8s presence poll while the friends panel is open).
  const presence = db.getFriends(account.id).map((f) => {
    const p = getAccountPresence(f.accountId);
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
  // No auth, no prior rate limit on this route at all — unlike its siblings (/comments,
  // /report), which both already got isPostMediaRateLimited this session. A scripted loop could
  // otherwise inflate any video's view count arbitrarily with unbounded DB writes. Skipping just
  // the write (not the whole route) when rate-limited, rather than 429ing the response, so a
  // real user quickly browsing several videos never sees the page itself fail to load — only
  // the vanity view-counter silently stops incrementing past the burst.
  const countedView = !isPostMediaRateLimited(req);
  if (countedView) db.bumpScorptureViews(video.id);
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
    views: video.views + (countedView ? 1 : 0),
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
    // Same block enforcement every other cross-account push channel already respects (friend-DM,
    // group-DM) — a subscription predates a block, so without this a channel owner's new-video/
    // went-live push would keep reaching someone they'd since blocked (or been blocked by).
    if (db.isBlockedBetween(channelId, subscriberId)) continue;
    sendPushToSubs(db.getPushSubscriptionsForAccount(subscriberId), payload);
  }
}

app.post('/api/scorpture/videos', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  // Unlike its siblings (.../comments, .../report — both already rate-limited), this insert-a-
  // new-row-with-no-cap route had no throttle of its own. Uploading the video file itself is
  // already rate-limited (POST /upload), but nothing stopped reusing that same already-uploaded
  // videoUrl across unlimited create calls, each one a fresh unbounded row in scorpture_videos.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many uploads too quickly — slow down a bit.' });
  const title = String(req.body.title || '').slice(0, 100).trim();
  const description = String(req.body.description || '').slice(0, 2000).trim();
  const videoUrl = typeof req.body.videoUrl === 'string' ? req.body.videoUrl.slice(0, 2000) : '';
  // Same /uploads/ prefix requirement the PUT (edit) route already enforces below and every
  // other "store this URL" route in the app (banner, avatar) enforces — this create route was
  // the one place a thumbnail could be set to an arbitrary external URL, letting an uploaded
  // video silently act as a tracking pixel against everyone who ever sees it listed.
  const thumbnailUrl = typeof req.body.thumbnailUrl === 'string' && req.body.thumbnailUrl.startsWith('/uploads/')
    ? req.body.thumbnailUrl.slice(0, 2000)
    : null;
  const category = SCORPTURE_CATEGORIES.includes(req.body.category) ? req.body.category : null;
  if (!title || !videoUrl.startsWith('/uploads/')) return res.status(400).json({ error: 'Missing title or video file' });
  // Claimed only after the title/videoUrl check above — a missing title (a real, plausible client
  // bug or user slip, not just a hypothetical) used to reject here *after* the video/thumbnail were
  // already marked claimed, orphaning a genuinely-uploaded file on disk forever with no sweep able
  // to reach it. Same fix as /post-image and /post-media above.
  claimUpload(videoUrl);
  claimUpload(thumbnailUrl);
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
  // Bounded to the caller's own video, but its sibling create route (POST /videos/:id/comments
  // below) already has this same gate — an unthrottled authenticated edit loop is still real DB
  // write pressure, just not unbounded growth like the view-counter above.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many edits too quickly — slow down a bit.' });
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
  claimUpload(thumbnailUrl);
  db.updateScorptureVideo(video.id, { title, description, category, thumbnailUrl });
  // Found by a file-upload storage audit: replacing the thumbnail here never deleted the file it
  // superseded — claimUpload only stops the NEW url from being swept as orphaned, it does nothing
  // for the old one, which nothing else ever references again. Same unbounded-disk-fill shape as
  // the video-delete route just above (upload near the cap, re-edit the thumbnail, repeat).
  if (thumbnailUrl !== video.thumbnail_url) deleteUploadFile(video.thumbnail_url);
  res.json({ ok: true, title, description, category, thumbnailUrl });
});

app.delete('/api/scorpture/videos/:id', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const video = db.getScorptureVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (video.uploader_id !== account.id) return res.status(403).json({ error: 'Not your video' });
  db.deleteScorptureVideo(video.id);
  // deleteScorptureVideo only removes the DB rows — without this, the actual video/thumbnail
  // files stay in public/uploads/ forever (an easy unbounded disk-fill: upload near the 300MB
  // cap, delete, repeat). Same deleteUploadFile() helper the room-retention cleanup job uses.
  deleteUploadFile(video.video_url);
  deleteUploadFile(video.thumbnail_url);
  res.json({ ok: true });
});

app.get('/api/scorpture/videos/:id/comments', (req, res) => {
  res.json({ comments: db.getScorptureComments(req.params.id) });
});

app.post('/api/scorpture/videos/:id/comments', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  // Same missing-flood-gate class of bug as /post-image /post-media above — a plain HTTP route
  // with no WebSocket, so it never hit the ws.msgTimestamps limiter every other message-creation
  // path shares.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many comments too quickly — slow down a bit.' });
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
  // Same gap as PUT /videos/:id above — its sibling create route already has this.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many edits too quickly — slow down a bit.' });
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
  // Unlike its sibling /like just above (a toggle — one row per account, bounded), every call
  // here inserts a brand-new report row with no cap, an unbounded-growth/admin-queue-spam vector.
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many reports too quickly' });
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
    description: channelAccount.scorpture_description || null,
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
  claimUpload(bannerUrl);
  if (!bannerUrl.startsWith('/uploads/')) return res.status(400).json({ error: 'Missing banner image' });
  const oldBannerUrl = account.scorpture_banner_url;
  db.setScorptureBanner(account.id, bannerUrl);
  // Found by a file-upload storage audit: replacing a banner/avatar never deleted the file it
  // superseded, letting an account re-upload near the 300MB cap indefinitely with no cleanup —
  // same unbounded-disk-fill shape as the video-delete/thumbnail-edit fixes above.
  if (bannerUrl !== oldBannerUrl) deleteUploadFile(oldBannerUrl);
  res.json({ ok: true, bannerUrl });
});

// Same "own account only" shape as /api/scorpture/banner — replaces the auto-generated
// initial-letter avatar (see avatarHtml() client-side) with an uploaded picture.
app.post('/api/scorpture/avatar', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl.slice(0, 2000) : '';
  claimUpload(avatarUrl);
  if (!avatarUrl.startsWith('/uploads/')) return res.status(400).json({ error: 'Missing avatar image' });
  const oldAvatarUrl = account.scorpture_avatar_url;
  db.setScorptureAvatar(account.id, avatarUrl);
  // Same leaked-file-on-replace fix as /api/scorpture/banner above.
  if (avatarUrl !== oldAvatarUrl) deleteUploadFile(oldAvatarUrl);
  res.json({ ok: true, avatarUrl });
});

// Same "own account only" shape as banner/avatar above — plain text, no upload involved.
app.post('/api/scorpture/description', (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 1000) : '';
  db.setScorptureDescription(account.id, description || null);
  res.json({ ok: true, description: description || null });
});

// Cosmetic-only admin panel, hardcoded to one specific account by its immutable id. Originally
// checked username *and* email instead — found by an account-recovery/email-flow audit to be a
// latent gap: email is never verified at signup (self-reported, and MAX_ACCOUNTS_PER_EMAIL even
// permits several accounts sharing one email), so it adds no real defense-in-depth, and account
// deletion doesn't exist in this app (confirmed by that same audit) so there was never actually a
// "deleted/recreated account" case to defend against in the first place — a username IS
// permanently reserved the moment its original owner holds it, but only for as long as they don't
// rename away from it, at which point anyone could reclaim 'supdid67' and self-declare the same
// email at signup, passing the old check outright. account.id is this app's one truly immutable,
// non-reusable identifier (a session-verified accounts.id, never reassigned), so it's the only
// safe thing to hardcode a permanent identity check against. The right-click-the-logo UI gate in
// videos.js is purely a discovery mechanic; this check here is the actual boundary, same
// getAccountFromReq(req) auth every other route uses, so there is no way to hit this by guessing
// a URL — it 403s anyone whose token doesn't resolve to this exact account.
const SCORPTURE_ADMIN_ACCOUNT_ID = '6b108ee9-cd84-44dc-a50f-823066886f9a';
function isScorptureAdmin(account) {
  return !!account && account.id === SCORPTURE_ADMIN_ACCOUNT_ID;
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
    // A non-object entry (null, a bare string, etc.) previously threw reading raw.type below,
    // caught only by the global error handler as a generic 500 — a real 400 is more honest about
    // what actually went wrong (a malformed request body, not a server-side failure).
    if (!raw || typeof raw !== 'object') return res.status(400).json({ error: 'Each overlay must be an object' });
    const type = OVERLAY_TYPES.includes(raw.type) ? raw.type : null;
    const position = OVERLAY_POSITIONS.includes(raw.position) ? raw.position : 'top-left';
    const content = String(raw.content || '').slice(0, type === 'text' ? 200 : 2000).trim();
    if (!type || !content) return res.status(400).json({ error: 'Each overlay needs a type and content' });
    if (type === 'image' && !content.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Image overlays must reference an uploaded file' });
    }
    overlays.push({ id: crypto.randomUUID(), type, content, position });
  }
  // Claimed only once every overlay in the list has passed validation — claiming inside the loop
  // above (as this used to) left earlier images in the list permanently claimed (exempt from the
  // orphan sweep forever) whenever a later item's validation failure aborted the whole request
  // before any of them were actually saved to setScorptureOverlays below. Same "claim only after
  // every rejection has already passed" ordering /post-image's fix elsewhere in this file already
  // established — this loop just hadn't gotten it.
  for (const o of overlays) {
    if (o.type === 'image') claimUpload(o.content);
  }
  // Found by a file-upload storage audit: this route replaces the whole overlay list every call,
  // but an old image overlay dropped from the new list (removed, or replaced with a fresh upload)
  // was never deleted — nothing else ever references it again once it drops out of this row. Same
  // unbounded-disk-fill shape as the banner/avatar/thumbnail fixes above; diffed against the new
  // list (not deleted unconditionally) so an image kept unchanged across saves survives.
  const keptUrls = new Set(overlays.filter((o) => o.type === 'image').map((o) => o.content));
  for (const old of db.getScorptureOverlays(account.id)) {
    if (old.type === 'image' && !keptUrls.has(old.content)) deleteUploadFile(old.content);
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
  // A connection can call join-server more than once with a *different* account's token without
  // ever disconnecting in between — signing out and into a different account in the same tab
  // (see app.js's signOutAccount, which only clears client-side state, no server message) then
  // sending a fresh join-server for the new account. Without unregistering the old association
  // first, that connection stays permanently stuck in the *old* account's accountConnections set
  // too — the old account would show as online (see getAccountPresence, which drives the friends
  // list's online indicator) forever, or until this connection eventually closes and
  // unregisterAccountConnection runs using whatever ws.accountId is *by then* (the new account),
  // still never cleaning up the stale old-account entry. Same stale-identity-mapping bug class as
  // voice's leaveVoice fix elsewhere in this file, just via ws.accountId instead of a sub key.
  // Same reassignment also has to tear down a live Scorpture broadcast under the OLD account id
  // first — liveStreams is keyed by accountId, so switching ws.accountId out from under an active
  // broadcaster (found by a signaling-authorization audit) would otherwise leave that stream
  // permanently orphaned: scorpture-end-live and the eventual close-handler cleanup both look up
  // liveStreams by *current* ws.accountId, so neither could ever reach it again, and its real
  // viewers would keep waiting on signaling that can never arrive.
  if (ws.accountId && ws.accountId !== accountId) {
    const oldStream = liveStreams.get(ws.accountId);
    if (oldStream && oldStream.ws === ws) endScorptureLive(ws.accountId);
    unregisterAccountConnection(ws);
  }
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

// Every minigame opens its own independent WebSocket from its own page (see the bc-join comment
// above), so kick-user/ban-user closing the *chat* connection never touched a target's
// already-open minigame tab for the same room — they'd stay a fully live participant (and, for
// ban, remain rejoinable-proof only against a *future* join, per the isBannedFromRoom checks
// added above, not evicted from a session already in progress). Reuses the exact same ws.on('close')
// cleanup every other disconnect already goes through — this just triggers it — rather than
// duplicating each game's own leave*() call here.
const MINIGAME_ROOM_FIELDS = ['bcRoom', 'gwRoom', 'swRoom', 'fgRoom', 'bbRoom', 'tvRoom', 'ttRoom', 'chRoom', 'hmRoom', 'dgRoom', 'wbRoom', 'arcadeRoom'];
function evictAccountFromRoomSessions(targetAccountId, roomCode) {
  if (!targetAccountId) return;
  const conns = accountConnections.get(targetAccountId);
  if (!conns) return;
  for (const c of [...conns]) {
    if (MINIGAME_ROOM_FIELDS.some((field) => c[field] === roomCode)) c.close(4000, 'Removed from room');
  }
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
    viewerWs._scorptureViewerIp = null;
  }
}

// A viewer's own connection dropping — tell the streamer so it can close that one peer connection
// instead of leaving a dead RTCPeerConnection open forever.
function leaveScorptureLive(ws) {
  if (!ws.scorptureStreamerAccountId) return;
  const stream = liveStreams.get(ws.scorptureStreamerAccountId);
  if (stream && ws.scorptureViewerId) {
    stream.viewers.delete(ws.scorptureViewerId);
    if (stream.viewerIps && ws._scorptureViewerIp) {
      const n = (stream.viewerIps.get(ws._scorptureViewerIp) || 1) - 1;
      if (n <= 0) stream.viewerIps.delete(ws._scorptureViewerIp);
      else stream.viewerIps.set(ws._scorptureViewerIp, n);
    }
    send(stream.ws, { type: 'scorpture-viewer-left', viewerId: ws.scorptureViewerId });
  }
  ws._scorptureViewerIp = null;
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

// Found by a TURN-credential-abuse audit: the shared relay's own port pool (~/valk-turn) is only
// 10 UDP ports, shared across every local Valk instance (prod/dev/test) — the generic per-IP
// isPostMediaRateLimited gate below (8/6s, sized for image/media uploads) was generous enough
// that one signed-in account could mint all 10 credentials in ~7 seconds and hold hour-long
// relay allocations open, starving every real cross-NAT viewer on every environment. A dedicated,
// tighter, per-ACCOUNT limit (not just per-IP, since the whole point is one account doing this)
// closes the fast-mint path while still comfortably covering a real broadcaster's page opening
// several viewer connections in a normal burst.
const turnCredentialRateLimits = new Map();
const TURN_CREDENTIAL_WINDOW_MS = 10000;
const TURN_CREDENTIAL_MAX = 5;
function isTurnCredentialRateLimited(accountId) {
  const now = Date.now();
  const timestamps = (turnCredentialRateLimits.get(accountId) || []).filter((t) => now - t < TURN_CREDENTIAL_WINDOW_MS);
  if (timestamps.length >= TURN_CREDENTIAL_MAX) {
    turnCredentialRateLimits.set(accountId, timestamps);
    return true;
  }
  timestamps.push(now);
  turnCredentialRateLimits.set(accountId, timestamps);
  if (turnCredentialRateLimits.size > 10000) turnCredentialRateLimits.clear();
  return false;
}

// Mints a short-lived TURN credential from the local valk-turn service (see ~/valk-turn — a
// separate always-on process shared by every local Valk instance) so live-stream viewers/
// broadcasters can relay through it when a direct WebRTC P2P path can't be found (e.g. across
// unrelated networks). Ephemeral rather than a single static secret baked into client JS — a
// leaked static TURN credential would let anyone use this connection as an open relay forever.
app.post('/api/scorpture/turn-credentials', async (req, res) => {
  const account = getAccountFromReq(req);
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  if (isTurnCredentialRateLimited(account.id)) return res.status(429).json({ error: 'Too many requests too quickly' });
  if (isPostMediaRateLimited(req)) return res.status(429).json({ error: 'Too many requests too quickly' });
  try {
    const turnRes = await fetch('http://127.0.0.1:3479/credential', { method: 'POST' });
    if (!turnRes.ok) throw new Error('valk-turn admin API returned ' + turnRes.status);
    const cred = await turnRes.json();
    res.json({ username: cred.username, credential: cred.credential, urls: cred.urls });
  } catch (err) {
    // valk-turn being down shouldn't break live streaming entirely — callers fall back to
    // STUN-only (works when a direct P2P path exists) rather than getting a hard error.
    reportError('server', { message: 'turn-credentials: valk-turn unreachable: ' + err.message }, {});
    res.status(503).json({ error: 'TURN relay unavailable' });
  }
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
  sendPushToSubs(db.getPushSubscriptionsForAccount(targetAccountId), { title: `${fromName} sent you a DM`, body: text, friendDm: true, fromUsername: fromName });
}

// Group DMs are persisted (unlike friend-dm above) since membership needs to survive everyone
// being offline. Delivery still reuses the same two-part pattern: live push over accountConnections
// for anyone currently connected, plus unconditional real push so offline members get notified too.
function sendGroupDm(groupId, fromAccountId, fromName, text, excludeWs) {
  const memberIds = db.getGroupDmMemberIds(groupId);
  const livePayload = JSON.stringify({ type: 'group-dm', groupId, fromAccountId, fromName, text, at: Date.now() });
  for (const accountId of memberIds) {
    // Blocking someone was a no-op inside a shared group DM (block only ever touched the
    // `friendships` table, and group-DM fan-out here never consulted it) — the blocked party
    // could keep posting and the blocker kept receiving their messages live + as real pushes,
    // completely defeating the point of blocking them. Skip delivery to a blocked pair (in
    // either direction) without touching group membership itself, so the rest of the group is
    // unaffected. Never true for accountId === fromAccountId (no self-block path exists), so
    // this doesn't interfere with the sender's own other-device sync below.
    if (db.isBlockedBetween(fromAccountId, accountId)) continue;
    const liveConnections = accountConnections.get(accountId);
    if (liveConnections) {
      for (const c of liveConnections) {
        if (c !== excludeWs && c.readyState === c.OPEN) c.send(livePayload);
      }
    }
    if (accountId === fromAccountId) continue;
    sendPushToSubs(db.getPushSubscriptionsForAccount(accountId), { title: `${fromName} (group)`, body: text, groupDm: true, groupId });
  }
}
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const HISTORY_LIMIT = 50;
const MAX_GAME_PLAYERS = 20;
const MAX_SCORPTURE_VIEWERS = 500;
const MAX_SCORPTURE_VIEWERS_PER_IP = 8;

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

// A poll message's `text` is JSON `{question, options}` (see the pollCreateForm handler in
// app.js) — nothing server-side ever checked it parses that way. A crafted `message` with
// mediaType:'poll' and arbitrary text (trivial via devtools/raw WS, no UI needed) reached
// renderPoll() client-side unguarded and threw, and since room history is rendered in one
// forEach with no per-item try/catch, that one bad poll permanently broke rendering of every
// message *after* it in that room's history for every future joiner.
const POLL_MAX_OPTIONS = 20;
function isValidPollText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed.question !== 'string' || !parsed.question.trim()) return false;
  if (!Array.isArray(parsed.options) || parsed.options.length < 2 || parsed.options.length > POLL_MAX_OPTIONS) return false;
  return parsed.options.every((o) => typeof o === 'string' && o.trim());
}
const BC_MAX_HEALTH = 10;
const BC_ARMOR_TIERS = ['Wooden', 'Stone', 'Iron', 'Gold', 'Diamond']; // must match ARMOR_REDUCTION's keys on the client
const BC_PUNCH_RANGE = 4.5; // a little slack beyond the client's own reach check, not authoritative geometry
const BC_PUNCH_COOLDOWN_MS = 450;
const BC_REGEN_INTERVAL_MS = 4000; // +1 heart every 4s once eligible
const BC_REGEN_DAMAGE_COOLDOWN_MS = 5000; // must go this long without taking damage before regen starts
const BC_CLAIM_RADIUS = 8; // must match CLAIM_RADIUS on the client
const BC_MAX_CLAIMS_PER_PLAYER = 3;
// A claim is "owned by" a player if their stable per-browser id matches (see bc-join) — falls
// back to comparing display name for claims placed before that id existed (owner_id is NULL) or
// if a connection somehow has no stableId of its own, so nothing already placed loses protection.
function bcClaimOwnedBy(claim, player) {
  if (claim.ownerId) return !!player.stableId && claim.ownerId === player.stableId;
  return claim.owner === player.name;
}
// Found by a blueprint/claim-ownership audit: claim.ownerId (the raw client-supplied stableId
// used for the check above) used to be broadcast verbatim to every room member — trivially
// readable off the wire, then replayable in a forged bc-join's own playerId to impersonate the
// victim's ownership and grief inside their claim. Nothing server-side actually needs another
// player's real stableId; each recipient only ever needs to know "is this claim mine," computed
// here per-recipient instead of leaking the identity value itself. owner (display name) is still
// sent — already public within the room the same way any other player name is.
function bcClaimForClient(claim, player) {
  return { x: claim.x, z: claim.z, radius: claim.radius, owner: claim.owner, isMine: bcClaimOwnedBy(claim, player) };
}
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
// Found by an unbounded-memory-growth audit: unlike whiteboard strokes (capped at 3000, oldest
// evicted — see room.wb.strokes below) or Pictionary strokes (same 3000 cap), Build Craft's
// per-cell block overrides had NO cap at all. bc-block is only gated by isStrokeRateLimited
// (20msg/sec) and each message can carry up to 2000 distinct cell changes, so one sustained
// client could grow room.bc.overrides (and the bc_overrides table in lockstep) into hundreds of
// MB-GB well within an hour — a single-threaded-process-wide DoS, not just that client's own
// session, and bc-init resends the ENTIRE overrides map to every new joiner so join latency/
// payload size scale with it too. 50000 is generous headroom for real creative building (a very
// large legitimate structure) while still being a hard ceiling; oldest-changed cells are evicted
// first once over it, the same "bounded history, not a gameplay guarantee" tradeoff already
// accepted for whiteboard/Pictionary strokes and room pins.
// Overridable so the regression suite can verify the eviction actually happens without needing
// to send tens of thousands of real cell changes; unset in production, no effect there.
const BC_MAX_OVERRIDES = Number(process.env.BC_MAX_OVERRIDES ?? 50000);
// Same audit: bc-claim had no room-wide cap at all — the only limit (BC_MAX_CLAIMS_PER_PLAYER)
// is keyed on a client-supplied, unverified stableId (see bc-join), so cycling WS connections
// with a fresh stableId each time resets that count to zero, letting claims grow without bound.
// isClaimedByOther (bc-block's per-change ownership check) does an O(claims) linear scan, so an
// inflated claims list also makes every player's ordinary block editing progressively slower —
// this caps the cost of that scan too, not just memory.
// Overridable for the same reason as BC_MAX_OVERRIDES above — a real test would otherwise need to
// send thousands of individual bc-claim messages (also individually flood-gated) to prove eviction.
const BC_MAX_ROOM_CLAIMS = Number(process.env.BC_MAX_ROOM_CLAIMS ?? 2000);
// ---- Web Swing PvP (web strikes) — small integer health scale, same convention as
// BC_MAX_HEALTH, since a strike (like a punch) is always worth exactly 1 point.
const SW_MAX_HEALTH = 3;
const SW_STRIKE_COOLDOWN_MS = 700;
// Positions here are broadcast at ~10/sec (see sendPosBroadcast's 100ms throttle) while players
// can move at up to MAX_SPEED=55 units/sec — up to ~5.5 units of staleness between updates on
// top of normal network latency, so this needs more slack than BC_PUNCH_RANGE's tight building-
// scale check. Loose sanity check, not authoritative geometry, same as everywhere else position
// is trust-the-client in this app.
const SW_STRIKE_RANGE = 30;
const SW_KILL_SCORE_BONUS = 20;
// Brief invulnerability after death/respawn. Fixes two related races found on independent review:
// (1) a freshly-respawned player's x/y/z aren't reset server-side (spawnPlatform is deterministic
// client-side, so the server has no coordinate to reset to) — they hold the death-location
// coordinates until their next ~100ms-throttled sw-pos update, so a second nearby attacker could
// land a "hit" using stale position data in that window; (2) two attackers' sw-strike messages
// landing back-to-back on a 1-health target both connect — the first kills (health resets to
// max), the second then lands a real hit on the "freshly alive" player, producing a spurious
// post-death damage flash/hurt sound right after the elimination toast. Both close once any
// strike attempt against a just-died target is rejected outright for a short window.
const SW_RESPAWN_GRACE_MS = 500;
// ---- Firefight — round-based 1v1 duel shooter (Rivals/tactical-shooter-inspired), on foot only,
// no vehicles. Exactly two active duelists (slotA/slotB) at a time; anyone else who joins queues
// as a spectator until a slot opens. Health/damage use a plain 0-150 scale (not the small-int
// convention SW/BC combat above use) since weapons deal varied, granular damage rather than
// always exactly 1 point. Same "trust the client's reported position, server just validates
// cooldown/range/alive-state before applying damage" model as bc-punch/sw-strike — not real
// anti-cheat, a loose sanity check.
const FG_MAX_HEALTH = 150;
// unlockKills is a career total (see fg_stats/bumpFgKills in db.js — a running count, unlike the
// generic leaderboard table's best-score-ever semantics), not a per-match one — earned kills carry
// over between matches and reconnects, same as a real shooter's weapon-unlock progression. Every
// weapon in the current fixed starting loadout is unlockKills:0 (all four are just always
// carried), but the field/enforcement stays live rather than being ripped out — it's exactly what
// a future locked/earnable weapon (from the larger backlog this loadout was deliberately scoped
// down from) would plug into without protocol changes.
const FG_WEAPONS = {
  pistol: { damage: 20, cooldownMs: 220, range: 45, unlockKills: 0 },
  assault_rifle: { damage: 18, cooldownMs: 110, range: 55, unlockKills: 0 },
  // Melee: no bullet, just a very short range — the existing distance-only hit check (no real
  // raycast/occlusion server-side, see fg-shoot below) already means "close enough" is the entire
  // requirement, so melee needed no new server logic at all, just a small range value.
  fists: { damage: 25, cooldownMs: 500, range: 2.4, unlockKills: 0, melee: true },
  // Thrown: resolves instantly server-side exactly like every other weapon here (same "trust the
  // client's aim, check range/cooldown" model) — the lobbed-arc flight and delayed explosion are
  // purely a client-side cosmetic layered on top, not an actual travel-time projectile. Its longer
  // cooldown and higher damage-per-hit are the actual balance lever, not flight time.
  grenade: { damage: 65, cooldownMs: 3200, range: 20, unlockKills: 0, thrown: true },
};
const FG_DEFAULT_WEAPON = 'assault_rifle';
function fgUnlockedWeapons(totalKills) {
  return Object.keys(FG_WEAPONS).filter((key) => totalKills >= FG_WEAPONS[key].unlockKills);
}
// Overridable via env, same pattern as several other constants in this file — lets the regression
// suite exercise a full round/intermission/match cycle in milliseconds instead of real minutes.
// Unset in production, no effect there.
const FG_ROUND_MS = Number(process.env.FG_ROUND_MS ?? 90 * 1000);
const FG_INTERMISSION_MS = Number(process.env.FG_INTERMISSION_MS ?? 6 * 1000);
const FG_ROUNDS_TO_WIN = Number(process.env.FG_ROUNDS_TO_WIN ?? 4);
// Same reasoning as SW_RESPAWN_GRACE_MS — a freshly-respawned/round-reset player's position isn't
// updated server-side until their next ~100ms-throttled fg-pos, so without this a shot fired in
// that window could land using stale position data against someone who should be safe.
// `?? ` (not `||`) — a real test wants to override this down to a genuine 0, and 0 is falsy, so
// `Number(...) || 500` would have silently ignored that override and kept the 500ms default.
const FG_RESPAWN_GRACE_MS = Number(process.env.FG_RESPAWN_GRACE_MS ?? 500);
// ---- Block Battle online lobby — unlike Firefight's fixed 2-slot duelist system, this is an
// open lobby (however many players, no spectator queue) where any two players can peer-to-peer
// challenge each other into a private 1v1; several pairs can be dueling simultaneously in the
// same lobby. One shared authoritative weapon profile — the client's own richer single-player
// weapon ladder is cosmetic/local-only for lobby combat, which uses this one profile for
// everyone so neither side's actual unlock progress affects duel fairness. Same "trust the
// client's reported position, server does a loose cooldown/range/alive-state check before
// applying damage" model as every other combat feature in this file.
const BB_MAX_HEALTH = 100;
const BB_WEAPON = { damage: 20, range: 60, cooldownMs: 150 };
// Same reasoning as FG_RESPAWN_GRACE_MS above (and SW_RESPAWN_GRACE_MS before it) — a
// freshly-started duel's position isn't updated server-side until the next ~100ms-throttled
// bb-pos, so without this a shot fired in that window could land using stale position data.
const BB_RESPAWN_GRACE_MS = Number(process.env.BB_RESPAWN_GRACE_MS ?? 500);

// ---- Block Battle NvN match stations ----
// Four fixed "match pad" stations along the office's open center aisle (see buildOffice() in
// blockbattle.js — cubicles sit at x = -9/-6/-3/3/6/9), each aligned with one of those cubicle
// columns so a station visually reads as "belonging" to that desk; plates themselves sit in the
// open aisle in front of it (z near 0), never on the cubicle's own solid furniture. Client's own
// BB_STATIONS mirrors this exactly for rendering — keep both in sync if this ever changes.
const BB_STATIONS = [
  { id: 'st1', n: 1, x: -9 },
  { id: 'st2', n: 2, x: -3 },
  { id: 'st3', n: 3, x: 3 },
  { id: 'st4', n: 4, x: 9 },
];

function bbInitStations() {
  const stations = {};
  for (const s of BB_STATIONS) {
    stations[s.id] = { n: s.n, queue: { a: new Array(s.n).fill(null), b: new Array(s.n).fill(null) }, matchId: null };
  }
  return stations;
}

// ---- Block Battle map voting ----
// Every 1v1 duel and NvN station match opens with a short map vote among just its own
// participants (not the whole lobby) before any fighting starts; once it resolves, the WHOLE
// lobby's shared space switches to the winning map (bb-lobby-map-changed) — everyone free-roaming
// sees the world change, not just the match's own players, since there's only ever one shared
// space (no separate teleport-to-an-arena instance, matching every other duel/match design in this
// file). Only the id list lives here for validating a vote against a real fixed set — the actual
// visual kits are entirely client-side (blockbattle.js's BB_MAPS/BB_MAP_KITS); the server never
// needs to know what a map looks like, only that it's real.
const BB_MAP_IDS = [
  'office', 'office_night', 'office_alert', 'office_gold', 'office_neon', 'office_dawn', 'office_jungle', 'office_server', 'office_panic', 'office_blackout', 'office_startup', 'office_legal', 'office_newsroom', 'office_gallery', 'office_callcenter', 'office_studio', 'office_mailroom', 'office_missioncontrol', 'office_dentist', 'office_aquarium', 'office_radio', 'office_photostudio', 'office_weather', 'office_boardroom', 'office_insurance', 'office_nursery', 'office_escaperoom', 'office_tradingfloor', 'office_podcast', 'office_lab', 'office_pharmacy', 'office_travel', 'office_bank', 'office_realestate',
  'warehouse_day', 'warehouse_dusk', 'warehouse_flood', 'warehouse_frost', 'warehouse_night', 'warehouse_toxic', 'warehouse_industrial', 'warehouse_steel', 'warehouse_harvest', 'warehouse_scrapyard', 'warehouse_auction', 'warehouse_container', 'warehouse_wine', 'warehouse_print', 'warehouse_brewery', 'warehouse_furniture', 'warehouse_distillery', 'warehouse_coldchain', 'warehouse_fireworks', 'warehouse_textile', 'warehouse_piano', 'warehouse_candle', 'warehouse_bakery', 'warehouse_ammodepot', 'warehouse_papermill', 'warehouse_chemplant', 'warehouse_tires', 'warehouse_cannery', 'warehouse_icecream', 'warehouse_mattress', 'warehouse_spice', 'warehouse_soap', 'warehouse_leather', 'warehouse_cotton', 'warehouse_glassworks',
  'rooftop_day', 'rooftop_sunset', 'rooftop_night', 'rooftop_storm', 'rooftop_dawn', 'rooftop_snow', 'rooftop_helipad', 'rooftop_penthouse', 'rooftop_observatory', 'rooftop_greenhouse', 'rooftop_solar', 'rooftop_antenna', 'rooftop_pool', 'rooftop_bar', 'rooftop_farm', 'rooftop_zen', 'rooftop_cinema', 'rooftop_chapel', 'rooftop_vineyard', 'rooftop_beehive', 'rooftop_icebar', 'rooftop_playground', 'rooftop_maze', 'rooftop_dronepad', 'rooftop_tennis', 'rooftop_herbgarden', 'rooftop_firepit', 'rooftop_stargazing', 'rooftop_solarium', 'rooftop_billboard', 'rooftop_windmill', 'rooftop_helipad2', 'rooftop_skybridge', 'rooftop_speakeasy',
  'garage_a', 'garage_b', 'garage_c', 'garage_d', 'garage_neon', 'garage_gold', 'garage_underground', 'garage_racetrack', 'garage_chopshop', 'garage_drift', 'garage_ev', 'garage_derby', 'garage_moto', 'garage_bikemsg', 'garage_tuner', 'garage_limo', 'garage_taxi', 'garage_foodtruck', 'garage_armored', 'garage_rv', 'garage_gokart', 'garage_monstertruck', 'garage_hearse', 'garage_crusher', 'garage_snowplow', 'garage_carmuseum', 'garage_ambulance', 'garage_drivingschool', 'garage_towyard', 'garage_schoolbus', 'garage_carwash', 'garage_junkyard', 'garage_valet2', 'garage_dragstrip', 'garage_bikeshop',
  'plaza_day', 'plaza_rain', 'plaza_dusk', 'plaza_market', 'plaza_snow', 'plaza_autumn', 'plaza_festival', 'plaza_zen', 'plaza_carnival', 'plaza_night_market', 'plaza_icerink', 'plaza_botanical', 'plaza_skatepark', 'plaza_farmersmarket', 'plaza_chess', 'plaza_fountain', 'plaza_amphitheater', 'plaza_cherryblossom', 'plaza_streetart', 'plaza_lantern', 'plaza_wedding', 'plaza_fairground', 'plaza_clocktower', 'plaza_reflectingpool', 'plaza_warmemorial', 'plaza_splashpad', 'plaza_duckpond', 'plaza_sundial', 'plaza_rosegarden', 'plaza_kite', 'plaza_topiary', 'plaza_bandstand', 'plaza_hedgemaze', 'plaza_lighthouse',
  'gym_basketball', 'gym_volleyball', 'gym_boxing', 'gym_championship', 'gym_wrestling', 'gym_beach', 'gym_neon', 'gym_dojo', 'gym_fencing', 'gym_midnight', 'gym_trampoline', 'gym_yoga', 'gym_climbing', 'gym_mma', 'gym_rollerdisco', 'gym_cheersquad', 'gym_curling', 'gym_bowling', 'gym_pingpong', 'gym_basement', 'gym_sumo', 'gym_archery', 'gym_track', 'gym_badminton', 'gym_squash', 'gym_weightlifting', 'gym_reformer', 'gym_handball', 'gym_divingpool', 'gym_gymnastics', 'gym_darts', 'gym_dance', 'gym_karate', 'gym_lacrosse',
];
// Cosmetic-only, same validate-a-fixed-set purpose as BB_MAP_IDS above — keep in sync with
// blockbattle.js's own BB_SKINS list. The server never needs to know what a skin looks like
// (that's client-side THREE.js material colors), only that a claimed id is a real one before it
// gets forwarded on to every other player in the lobby.
const BB_SKIN_IDS = ['default', 'khaki', 'sand', 'forest', 'rust', 'coral', 'ember', 'arctic', 'crimson', 'garnet', 'copper', 'toxic', 'shadow', 'teal', 'jade', 'indigo', 'violet', 'neon', 'plague', 'sunset', 'amber', 'royal', 'blaze', 'storm', 'solar', 'magma', 'gold', 'lagoon', 'platinum', 'steel', 'chrome', 'blood', 'ocean', 'onyx', 'inferno', 'slate', 'abyss', 'obsidian', 'aurora', 'opal', 'glacier', 'prestige', 'frostbite', 'void', 'nebula', 'ivory', 'cosmic', 'radiant', 'eclipse', 'phantom', 'starlight', 'quantum'];
const BB_MATCH_VOTE_MS = Number(process.env.BB_MATCH_VOTE_MS ?? 10000);
// First side to win this many rounds takes the match — same "kill ends the round, respawn,
// continue" shape as Firefight's FG_ROUNDS_TO_WIN, just without a round time limit (BB combat has
// never had one; a round here only ends on an elimination).
const BB_ROUNDS_TO_WIN = Number(process.env.BB_ROUNDS_TO_WIN ?? 5);

function bbMapTally(votesMap) {
  const tally = {};
  for (const mapId of votesMap.values()) tally[mapId] = (tally[mapId] || 0) + 1;
  return tally;
}

// Deliberately a fixed-duration window rather than "finalize early once everyone's voted" —
// tracking that against players joining/leaving mid-vote is real extra state for a marginal UX
// win; a flat timer is simpler and can't drift out of sync with itself. Falls back to a uniformly
// random map if literally nobody voted, so a match/duel can never get stuck map-less forever.
function bbPickMap(votesMap) {
  const tally = bbMapTally(votesMap);
  let winners = [];
  let best = 0;
  for (const mapId of BB_MAP_IDS) {
    const count = tally[mapId] || 0;
    if (count > best) { best = count; winners = [mapId]; }
    else if (count === best && count > 0) winners.push(mapId);
  }
  return winners.length ? winners[Math.floor(Math.random() * winners.length)] : BB_MAP_IDS[Math.floor(Math.random() * BB_MAP_IDS.length)];
}

// The vote-closes half of bb-challenge-response's accept branch — resets both duelists' health,
// sends bb-duel-started (round 1, now carrying the decided map), and tells the whole lobby (not
// just these two) to switch to it, same "one shared space" reasoning as finalizeBbMatchVote.
function finalizeBbDuelVote(code, duelId) {
  const room = rooms.get(code);
  const bb = room && room.bb;
  const duel = bb && bb.duels.get(duelId);
  if (!duel || duel.phase !== 'voting') return;
  const mapId = bbPickMap(duel.mapVotes);
  duel.phase = 'active';
  duel.mapVotes.clear();
  duel.voteTimer = null;
  bb.currentMapId = mapId;
  const aP = bb.players.get(duel.aWs), bP = bb.players.get(duel.bWs);
  // One side vanished mid-vote — leaveBb's own duel-cleanup already ended this duel and deleted
  // this bb.duels entry for the departure itself; nothing left to finalize.
  if (!aP || !bP) return;
  const now = Date.now();
  aP.health = BB_MAX_HEALTH; aP.respawnedAt = now;
  bP.health = BB_MAX_HEALTH; bP.respawnedAt = now;
  send(duel.aWs, { type: 'bb-duel-started', opponentId: bP.id, opponentName: bP.name, roundsWon: 0, roundsLost: 0, mapId });
  send(duel.bWs, { type: 'bb-duel-started', opponentId: aP.id, opponentName: aP.name, roundsWon: 0, roundsLost: 0, mapId });
  broadcastBb(code, { type: 'bb-lobby-map-changed', mapId });
}

// What every client needs to render one station's plates: which slots are filled (by name, so a
// label can be drawn without a second id lookup) and whether it's mid-match (locked — plates stay
// reserved for that match's own participants until it ends, so a second group can't pile onto the
// same physical spot while a match is still being fought there).
function bbStationSnapshot(bb, stationId) {
  const station = bb.stations[stationId];
  const nameOf = (ws) => { const p = ws && bb.players.get(ws); return p ? p.name : null; };
  return { stationId, a: station.queue.a.map(nameOf), b: station.queue.b.map(nameOf), inProgress: !!station.matchId };
}

function broadcastBbStation(code, stationId) {
  const room = rooms.get(code);
  const bb = room && room.bb;
  if (!bb) return;
  broadcastBb(code, { type: 'bb-station-update', ...bbStationSnapshot(bb, stationId) });
}

// Clears whichever plate slot (if any) `ws` currently occupies — called both by an explicit
// bb-plate-leave and by leaveBb() on disconnect, so a player who vanishes mid-queue doesn't leave
// a phantom slot nobody else can ever fill.
function bbClearPlate(bb, code, ws) {
  const p = bb.players.get(ws);
  if (!p || !p.plateStation) return;
  const stationId = p.plateStation, side = p.plateSide, slot = p.plateSlot;
  p.plateStation = null; p.plateSide = null; p.plateSlot = null;
  const station = bb.stations[stationId];
  if (station && station.queue[side][slot] === ws) station.queue[side][slot] = null;
  broadcastBbStation(code, stationId);
}

// Once both sides of a station are fully staffed, locks the station and opens a map vote among
// just this match's own participants (mirrors bb-challenge-response's dueling/opponentId pair,
// generalized to a whole side instead of one opponent) — the queue itself is emptied so the next
// group can start staffing the instant this one ends. Combat doesn't actually start yet; see
// finalizeBbMatchVote for the part that used to happen here directly (team assignment, health
// reset, bb-match-started) before per-match voting existed.
function bbTryStartMatch(bb, code, stationId) {
  const station = bb.stations[stationId];
  if (!station || station.matchId) return;
  if (station.queue.a.some((w) => !w) || station.queue.b.some((w) => !w)) return;
  const matchId = crypto.randomUUID();
  const sideA = station.queue.a.slice();
  const sideB = station.queue.b.slice();
  station.matchId = matchId;
  station.queue = { a: new Array(station.n).fill(null), b: new Array(station.n).fill(null) };
  const voteEndsAt = Date.now() + BB_MATCH_VOTE_MS;
  const match = {
    stationId, sideA: new Set(sideA), sideB: new Set(sideB),
    roundsWonA: 0, roundsWonB: 0, phase: 'voting', mapVotes: new Map(), voteEndsAt, voteTimer: null,
  };
  bb.matches.set(matchId, match);
  // eliminated/health are reset here too (not just once voting resolves in finalizeBbMatchVote) so
  // a disconnect during the vote window — or bb-shoot's own myMatch.phase !== 'active' guard,
  // belt-and-suspenders — never has to reason about a stale value left over from whatever this
  // player was doing right before queueing up (free-roaming, or a just-finished previous match).
  for (const w of sideA) { const p = bb.players.get(w); p.plateStation = null; p.matchId = matchId; p.matchSide = 'a'; p.eliminated = false; p.health = BB_MAX_HEALTH; }
  for (const w of sideB) { const p = bb.players.get(w); p.plateStation = null; p.matchId = matchId; p.matchSide = 'b'; p.eliminated = false; p.health = BB_MAX_HEALTH; }
  match.voteTimer = setTimeout(() => finalizeBbMatchVote(code, matchId), BB_MATCH_VOTE_MS);
  broadcastToBbMatch(bb, matchId, { type: 'bb-match-map-vote', matchId, voteEndsAt, tally: {} });
  broadcastBbStation(code, stationId);
}

// The vote-closes half of what bbTryStartMatch used to do all at once: assigns rosters, resets
// health/elimination, sends bb-match-started (now carrying the decided map), and tells the whole
// lobby (not just this match's players) to switch to it — there's only one shared space, no
// separate teleport-to-an-arena instance, so a match's map really is the whole lobby's map for as
// long as that match is running.
function finalizeBbMatchVote(code, matchId) {
  const room = rooms.get(code);
  const bb = room && room.bb;
  const match = bb && bb.matches.get(matchId);
  if (!match || match.phase !== 'voting') return;
  const mapId = bbPickMap(match.mapVotes);
  match.phase = 'active';
  match.mapVotes.clear();
  match.voteTimer = null;
  bb.currentMapId = mapId;
  const rosterOf = (wsSet) => [...wsSet].map((w) => { const p = bb.players.get(w); return p ? { id: p.id, name: p.name } : null; }).filter(Boolean);
  const teamA = rosterOf(match.sideA), teamB = rosterOf(match.sideB);
  const station = bb.stations[match.stationId];
  const now = Date.now();
  for (const w of match.sideA) {
    const p = bb.players.get(w);
    if (!p) continue;
    p.eliminated = false; p.health = BB_MAX_HEALTH; p.respawnedAt = now;
    send(w, { type: 'bb-match-started', matchId, stationId: match.stationId, n: station ? station.n : teamA.length, side: 'a', teammates: teamA.filter((t) => t.id !== p.id), enemies: teamB, mapId });
  }
  for (const w of match.sideB) {
    const p = bb.players.get(w);
    if (!p) continue;
    p.eliminated = false; p.health = BB_MAX_HEALTH; p.respawnedAt = now;
    send(w, { type: 'bb-match-started', matchId, stationId: match.stationId, n: station ? station.n : teamB.length, side: 'b', teammates: teamB.filter((t) => t.id !== p.id), enemies: teamA, mapId });
  }
  broadcastBb(code, { type: 'bb-lobby-map-changed', mapId });
}

// Sends to just the participants of one match (both sides) — used for elimination/vote updates,
// which only that match's own roster/vote panels need to know about, unlike a station's occupancy
// (which the whole room can see forming) or a hit/miss (which only concerns the two people involved).
function broadcastToBbMatch(bb, matchId, data) {
  const match = bb.matches.get(matchId);
  if (!match) return;
  for (const w of new Set([...match.sideA, ...match.sideB])) {
    if (w.readyState === w.OPEN) send(w, data);
  }
}

// Fully ends a match (5th round win, both sides simultaneously wiped, or a disconnect that empties
// a side before any round was actually played) — the part bbCheckMatchEnd used to do unconditionally
// on any single elimination, before rounds existed.
function bbEndMatch(bb, code, matchId, winnerSlot) {
  const match = bb.matches.get(matchId);
  if (!match) return;
  if (match.voteTimer) clearTimeout(match.voteTimer);
  for (const w of new Set([...match.sideA, ...match.sideB])) {
    const p = bb.players.get(w);
    if (!p || p.matchId !== matchId) continue;
    send(w, { type: 'bb-match-ended', matchId, won: winnerSlot ? p.matchSide === winnerSlot : null, roundsWonA: match.roundsWonA, roundsWonB: match.roundsWonB });
    p.matchId = null; p.matchSide = null; p.eliminated = false; p.health = BB_MAX_HEALTH;
  }
  bb.matches.delete(matchId);
  const station = bb.stations[match.stationId];
  if (station && station.matchId === matchId) station.matchId = null;
  broadcastBbStation(code, match.stationId);
}

// Respawns everyone still in the match (same map, same teams) to start the next round — called
// both right after a round win (bbCheckMatchEnd) and never on the match's own initial start (that
// path already resets health itself in finalizeBbMatchVote, since round 1 needs the roster/started
// message finalizeBbMatchVote sends, which this function deliberately doesn't duplicate).
function bbRestartMatchRound(bb, matchId) {
  const match = bb.matches.get(matchId);
  if (!match) return;
  const now = Date.now();
  for (const w of new Set([...match.sideA, ...match.sideB])) {
    const p = bb.players.get(w);
    if (!p || p.matchId !== matchId) continue;
    p.eliminated = false; p.health = BB_MAX_HEALTH; p.respawnedAt = now;
  }
  broadcastToBbMatch(bb, matchId, { type: 'bb-match-round-start', roundsWonA: match.roundsWonA, roundsWonB: match.roundsWonB });
}

// Ends a match the instant one side has zero remaining (non-eliminated, still-connected) members —
// covers both "shot down to 0 health" and "disconnected mid-match" through the same path, since a
// disconnected player is simply absent from bb.players by the time this runs (see leaveBb below).
// A single elimination-to-zero used to end the whole match; now it's just a round win — the match
// itself only ends once a side reaches BB_ROUNDS_TO_WIN.
function bbCheckMatchEnd(bb, code, matchId) {
  const match = bb.matches.get(matchId);
  if (!match) return;
  const aliveCount = (side) => [...side].filter((w) => { const p = bb.players.get(w); return p && p.matchId === matchId && !p.eliminated; }).length;
  const aliveA = aliveCount(match.sideA), aliveB = aliveCount(match.sideB);
  if (aliveA > 0 && aliveB > 0) return;
  // A disconnect during the pre-match map vote (phase still 'voting', nobody's actually fought
  // yet) just ends the match outright rather than crediting a round nobody played.
  if (match.phase !== 'active') {
    bbEndMatch(bb, code, matchId, aliveA === 0 && aliveB === 0 ? null : aliveA === 0 ? 'b' : 'a');
    return;
  }
  if (aliveA === 0 && aliveB === 0) { bbEndMatch(bb, code, matchId, null); return; }
  const winnerSlot = aliveA === 0 ? 'b' : 'a';
  if (winnerSlot === 'a') match.roundsWonA += 1; else match.roundsWonB += 1;
  const winnerRounds = winnerSlot === 'a' ? match.roundsWonA : match.roundsWonB;
  if (winnerRounds >= BB_ROUNDS_TO_WIN) { bbEndMatch(bb, code, matchId, winnerSlot); return; }
  broadcastToBbMatch(bb, matchId, { type: 'bb-match-round-end', winnerSlot, roundsWonA: match.roundsWonA, roundsWonB: match.roundsWonB });
  bbRestartMatchRound(bb, matchId);
}

function broadcastBb(code, data, exclude) {
  const room = rooms.get(code);
  if (!room || !room.bb) return;
  for (const [otherWs] of room.bb.players) {
    if (otherWs !== exclude && otherWs.readyState === otherWs.OPEN) send(otherWs, data);
  }
}

// Finds a lobby member by their bb id (not the raw ws) — every handler below identifies its
// target this way, since a client only ever knows opponents/challenge-targets by id.
function bbFindById(bb, id) {
  for (const [otherWs, p] of bb.players) {
    if (p.id === id) return { ws: otherWs, p };
  }
  return null;
}

// A player is unavailable to challenge or be challenged into a 1v1 while already mid-duel,
// mid-NvN-match, or queued on a plate — checked on both sides of both bb-challenge/
// bb-challenge-response.
function bbIsBusy(p) {
  return p.dueling || p.matchId || p.plateStation;
}

function leaveBb(ws) {
  const code = ws.bbRoom;
  if (!code) return;
  const room = rooms.get(code);
  const bb = room && room.bb;
  if (bb) {
    const player = bb.players.get(ws);
    if (player) {
      // Mid-duel departure ends it for the other side too — same as leaveFg resetting an
      // in-progress match when a duelist disconnects, so nobody's left dueling a ghost. Also tears
      // down the bb.duels entry itself (including a still-pending pre-duel map vote timer) —
      // without clearing that timer, it would fire later against a stale/deleted duel object.
      if (player.opponentId) {
        const opp = bbFindById(bb, player.opponentId);
        if (opp) { opp.p.dueling = false; opp.p.opponentId = null; opp.p.duelId = null; send(opp.ws, { type: 'bb-duel-ended', reason: 'opponent-left' }); }
        if (player.duelId) {
          const duel = bb.duels.get(player.duelId);
          if (duel && duel.voteTimer) clearTimeout(duel.voteTimer);
          bb.duels.delete(player.duelId);
        }
      }
      // Free a plate the instant its occupant vanishes (so nobody's queue slot is ever stuck on a
      // disconnected connection), and re-check an in-progress NvN match after removing them from
      // bb.players below — bbCheckMatchEnd counts survivors straight off that map, so a departed
      // player is automatically no longer "alive" without any extra bookkeeping here (including a
      // still-pending pre-match vote timer, cleared via bbEndMatch when that leaves a side empty).
      if (player.plateStation) bbClearPlate(bb, code, ws);
      const matchId = player.matchId;
      // A 2v2+ match survives one side losing a member (unlike a duel, which always ends outright
      // above) — if this player had already cast a vote in that match's still-open pre-fight
      // window, it would otherwise keep counting in every future tally/tie-break forever, a
      // phantom voter biasing the map choice for teammates who are still actually there.
      if (matchId) {
        const match = bb.matches.get(matchId);
        if (match && match.phase === 'voting' && match.mapVotes.delete(ws)) {
          broadcastToBbMatch(bb, matchId, { type: 'bb-match-map-vote-update', tally: bbMapTally(match.mapVotes) });
        }
      }
      bb.players.delete(ws);
      if (matchId) bbCheckMatchEnd(bb, code, matchId);
      broadcastBb(code, { type: 'bb-player-left', id: player.id });
      clearRoomActivity(code, player.name);
    }
    if (bb.players.size === 0) delete room.bb;
  }
  ws.bbRoom = null;
  ws.bbId = null;
}
// ---- Single-player arcade games (Snake, 2048) — no shared room state to speak of, just a
// per-room best-score leaderboard reusing the same generic `leaderboard` table every other
// game already uses. One handler pair covers both instead of duplicating near-identical code.
const ARCADE_LEADERBOARD_KEY = { snake: 'snake', '2048': 'g2048', fighterplane: 'fighterplane' };
const ARCADE_ACTIVITY_CODE = { snake: 'sk', '2048': 'tf', fighterplane: 'fp' };
// arcade-submit-score is fully client-computed (flagged in review as a known, accepted, low-
// severity gap — a real fix needs server-side gameplay simulation, out of scope) but had no
// throttle at all, unlike every score/message-creation path elsewhere in this app. These two
// checks don't make cheating impossible, just cheaper to deter: a submission cooldown (matching
// the flood-gate convention everywhere else) and a minimum time since arcade-join (blocks the
// trivial "join then immediately submit 100000" case without needing real anti-cheat).
const ARCADE_SUBMIT_COOLDOWN_MS = 2000;
const ARCADE_SUBMIT_MIN_SESSION_MS = 3000;
const RATE_LIMIT_WINDOW_MS = 6000;
const RATE_LIMIT_MAX_MESSAGES = 8; // generous for real typing/conversation, tight enough to stop a flood
// Every isWsMsgRateLimited/isStrokeRateLimited flood gate in this file (there are many — chat
// messages, reactions, typing, dg-guess, create-group-dm, bc-fall-damage, scorpture-signal,
// whiteboard strokes, and more) is tracked on the `ws` connection object itself
// (ws.msgTimestamps/ws.strokeTimestamps). That's fine against a client sending too fast on one
// connection, but nothing capped how fast a client could open brand-new connections — and a fresh
// connection means a fresh object with no timestamps yet. Without this, every one of those flood
// gates was trivially bypassable by just reconnecting whenever the limit was hit, no slower than
// the WS handshake itself allows: open a connection, burst up to the limit, disconnect, repeat.
// This closes that off at the root (new-connection rate, not each gate's own per-message rate) —
// generous enough that no legitimate reconnect pattern (a network blip, a page reload, several
// tabs) comes close, since this app's client only ever holds one WS connection open per tab and
// only reconnects on an actual drop.
// Deliberately generous — this app runs behind shared NAT often enough (a household, a LAN
// party, a small office) that several genuinely distinct people can share one apparent IP and all
// reasonably reconnect around the same time (e.g. right after a server restart). Even at this
// generous a cap, a reconnect-cycling attacker goes from literally unbounded to a hard ceiling —
// a real improvement — without meaningfully risking false positives against legitimate bursts.
// Overridable via env (see below) so the regression suite can verify the mechanism with a small
// number of connections instead of needing hundreds; unset in production, no effect there.
const WS_CONNECT_LIMIT_WINDOW_MS = Number(process.env.WS_CONNECT_LIMIT_WINDOW_MS ?? 60 * 1000);
const WS_CONNECT_LIMIT_MAX = Number(process.env.WS_CONNECT_LIMIT_MAX ?? 60);
const wsConnectRateLimits = new Map();
function isWsConnectRateLimited(ip) {
  const now = Date.now();
  const timestamps = (wsConnectRateLimits.get(ip) || []).filter((t) => now - t < WS_CONNECT_LIMIT_WINDOW_MS);
  if (timestamps.length >= WS_CONNECT_LIMIT_MAX) {
    wsConnectRateLimits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  wsConnectRateLimits.set(ip, timestamps);
  if (wsConnectRateLimits.size > 10000) wsConnectRateLimits.clear(); // crude bound on worst-case memory
  return false;
}
// The ws.msgTimestamps flood-gate check (filter/compare/push) was copy-pasted verbatim at every
// call site that adopted it over many sessions — extracted once, same pattern isStrokeRateLimited
// below already uses for its own per-connection limiter.
function isWsMsgRateLimited(ws) {
  const now = Date.now();
  ws.msgTimestamps = (ws.msgTimestamps || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (ws.msgTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) return true;
  ws.msgTimestamps.push(now);
  return false;
}
// Whiteboard/Pictionary strokes are far more frequent than chat messages by nature (the client
// already throttles its own sends to one per STROKE_FLUSH_MS=80ms, ~12.5/sec) and each one does
// a synchronous better-sqlite3 write — unlike RATE_LIMIT_MAX_MESSAGES above, this cap only needs
// to catch a raw-WS flood well past normal drawing speed, not slow down real use.
const STROKE_LIMIT_WINDOW_MS = 2000;
const STROKE_LIMIT_MAX = 40;
function isStrokeRateLimited(ws) {
  const now = Date.now();
  ws.strokeTimestamps = (ws.strokeTimestamps || []).filter((t) => now - t < STROKE_LIMIT_WINDOW_MS);
  if (ws.strokeTimestamps.length >= STROKE_LIMIT_MAX) return true;
  ws.strokeTimestamps.push(now);
  return false;
}
const ROOM_CREATE_WINDOW_MS = 60000;
const ROOM_CREATE_MAX = 5; // one connection shouldn't need more than a handful of rooms a minute
const REPORT_WINDOW_MS = 300000;
const REPORT_MAX = 5; // real abuse reporting is rare enough that 5/5min is generous, not restrictive
const AUTH_LIMIT_WINDOW_MS = 60000;
// Overridable via env, same as WS_CONNECT_LIMIT_MAX above — the regression suite's shared test
// instance runs many distinct signups/logins across dozens of unrelated describe blocks within
// this window (they all come from one loopback IP, simulating many real, distinct users who'd
// never actually share an IP), and would otherwise start 429ing unrelated tests' setup steps once
// enough of the suite had run. Unset in production, no effect there.
const AUTH_LIMIT_MAX = Number(process.env.AUTH_LIMIT_MAX ?? 8); // signup/login call scryptSync (CPU-bound, synchronous) — cheap to flood without this
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
  // `muted` lets the host's own client render an unmute option — unmute-user has always existed
  // server-side (and is fully tested), but the client never had any way to know who was already
  // muted (not even freshly after clicking mute-user, and definitely not after a page refresh
  // mid-session), so the mute button had no toggle-back path and hosts had no way to undo a mute
  // from the UI at all.
  return [...room.clients].map((c) => ({
    name: c.profile.name,
    avatarUrl: c.profile.avatarUrl,
    status: c.profile.status,
    muted: !!(room.muted && room.muted.has(c.profile.name)),
  }));
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
  // Every minigame's own dedicated WebSocket (Build Craft, Geometry Wave, Web Swing, Firefight,
  // Trivia, arcade games, Hangman, chess, tic-tac-toe/Connect Four, Pictionary, whiteboard — this
  // function's every call site) never goes through the main chat page's join-room/message paths
  // that normally refresh rooms.last_active_at. A room reached only via a bookmarked/shared
  // minigame link — real, ongoing play, never a single chat message sent — would otherwise have
  // last_active_at frozen at whatever it was on the room's first touch since the last server
  // restart, and cleanupInactiveRooms' 90-day sweep (irreversible — no DB backup exists) would
  // eventually delete an actively-played room's entire world/game state out from under it.
  db.upsertRoom(code);
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
  // Found by ws identity, not by trusting the connection's *current* ws.profile.sub as the map
  // key — join-server can fire again on an already-open connection (signing into an account
  // mid-session, see app.js's "Covers signing into an account after the WebSocket already sent
  // its (accountless) join-server" comment) and unconditionally assigns a fresh
  // crypto.randomUUID() sub every time. If a voice-join happened under the old sub before that
  // reassignment, voice.get(ws.profile.sub) here would miss it entirely — the entry stays in the
  // map forever under a sub value this connection no longer reports, a permanent orphan that
  // still shows up as a "participant" (and a dead signaling target) to everyone who joins the
  // call afterward. Searching by the actual ws reference finds it regardless of which sub it was
  // filed under.
  // Collects every matching sub, not just the first — a voice-join sent again after a mid-call
  // ws.profile reassignment (see the comment above) adds a SECOND entry for this same ws under
  // the new sub, alongside the still-present old one; breaking after one match left that second
  // entry permanently orphaned (found by a systematic sweep for this exact bug shape).
  const staleSubs = [];
  for (const [s, e] of voice) {
    if (e.ws === ws) staleSubs.push(s);
  }
  if (!staleSubs.length) return;
  for (const sub of staleSubs) {
    voice.delete(sub);
    for (const peer of voice.values()) send(peer.ws, { type: 'voice-peer-left', sub });
  }
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

// Shared by bc-sleep (after adding a sleeper) and leaveBc (after a disconnect shrinks
// bc.players) — checking the consensus threshold only at bc-sleep time meant a non-sleeping
// player disconnecting while others waited never got re-evaluated: sleeping.size could already
// numerically satisfy the (now smaller) players.size with nothing left to ever re-trigger the
// check, leaving every sleeper stuck showing "waiting for everyone else" forever.
function checkBcSleepConsensus(code, bc) {
  if (!bc.sleeping || bc.sleeping.size === 0 || bc.sleeping.size < bc.players.size || bc.players.size === 0) return;
  const now = Date.now();
  const offset = bc.dayNightOffsetMs || 0;
  const phase = ((now + offset) % BC_DAY_CYCLE_MS) / BC_DAY_CYCLE_MS;
  const targetPhase = phase > 0.8 ? 1 + BC_SLEEP_PHASE_TARGET : BC_SLEEP_PHASE_TARGET;
  bc.dayNightOffsetMs = offset + (targetPhase - phase) * BC_DAY_CYCLE_MS;
  bc.sleeping.clear();
  broadcastBc(code, { type: 'bc-skip-night', offsetMs: bc.dayNightOffsetMs });
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
    checkBcSleepConsensus(code, room.bc);
    broadcastBc(code, { type: 'bc-player-left', id: ws.bcId });
    if (player) clearRoomActivity(code, player.name);
    // World overrides and claims are both persisted to SQLite (db.setBcOverrides / db.addBcClaim)
    // and rehydrated on the next bc-join (via db.getBcOverrides / db.getBcClaims), so it's safe to
    // drop this in-memory session once nobody's left playing — otherwise it (voice map and all)
    // stays resident forever, same pattern leaveTv/leaveDg already use below.
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

// ---- Firefight (room.fg) — see the FG_* constants above for the overall design. Broadcasts go
// to every connection in fg.players (both active duelists and queued spectators), same as every
// other minigame's broadcast helper in this file.
function broadcastFg(code, data, exclude) {
  const room = rooms.get(code);
  const fg = room && room.fg;
  if (!fg) return;
  const payload = JSON.stringify(data);
  for (const client of fg.players.keys()) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

function fgSlotOf(fg, ws) {
  if (fg.slotA === ws) return 'a';
  if (fg.slotB === ws) return 'b';
  return null;
}

// Resets both duelists to full health/alive and starts a fresh round clock. Called for the very
// first round of a match and again after each intermission — always re-checked against the
// current slotA/slotB (not cached), since either duelist could have left/been replaced since the
// timer was scheduled.
function startFgRound(code) {
  const room = rooms.get(code);
  const fg = room && room.fg;
  if (!fg || !fg.slotA || !fg.slotB) return;
  for (const ws of [fg.slotA, fg.slotB]) {
    const p = fg.players.get(ws);
    if (!p) continue;
    p.health = FG_MAX_HEALTH;
    p.alive = true;
    p.respawnedAt = Date.now();
  }
  fg.phase = 'active';
  fg.roundNumber += 1;
  fg.roundEndAt = Date.now() + FG_ROUND_MS;
  clearTimeout(fg.timer);
  fg.timer = setTimeout(() => endFgRound(code, null), FG_ROUND_MS);
  broadcastFg(code, { type: 'fg-round-start', roundNumber: fg.roundNumber, endsAt: fg.roundEndAt, scoreA: fg.scoreA, scoreB: fg.scoreB });
}

// winnerSlot is 'a'/'b' (an elimination), or null (the round clock ran out — a draw, no score,
// same shape as a real tactical shooter's round timer expiring with both sides still alive).
function endFgRound(code, winnerSlot) {
  const room = rooms.get(code);
  const fg = room && room.fg;
  if (!fg || fg.phase !== 'active') return;
  clearTimeout(fg.timer);
  if (winnerSlot === 'a') fg.scoreA += 1;
  else if (winnerSlot === 'b') fg.scoreB += 1;

  if (fg.scoreA >= FG_ROUNDS_TO_WIN || fg.scoreB >= FG_ROUNDS_TO_WIN) {
    const matchWinnerSlot = fg.scoreA > fg.scoreB ? 'a' : 'b';
    const matchWinnerWs = matchWinnerSlot === 'a' ? fg.slotA : fg.slotB;
    const matchWinner = matchWinnerWs && fg.players.get(matchWinnerWs);
    // Total kills across the whole match, not just this round — a meaningful "best duel
    // performance" score for the room's leaderboard, only recorded once per match (not per round).
    if (matchWinner) db.bumpLeaderboard(code, 'fg', matchWinner.name, matchWinner.kills);
    fg.phase = 'match-end';
    broadcastFg(code, { type: 'fg-match-end', winner: matchWinnerSlot, scoreA: fg.scoreA, scoreB: fg.scoreB });
    // A fresh fg-start is required for a new match — same "explicit start, not auto-restart"
    // convention every other round-based minigame in this file uses (dg-start, tv-start).
    fg.phase = 'waiting';
    fg.scoreA = 0;
    fg.scoreB = 0;
    fg.roundNumber = 0;
    for (const ws of [fg.slotA, fg.slotB]) {
      const p = ws && fg.players.get(ws);
      if (p) p.kills = 0;
    }
    return;
  }

  fg.phase = 'intermission';
  broadcastFg(code, { type: 'fg-round-end', winnerSlot, scoreA: fg.scoreA, scoreB: fg.scoreB });
  fg.timer = setTimeout(() => startFgRound(code), FG_INTERMISSION_MS);
}

function leaveFg(ws) {
  const code = ws.fgRoom;
  if (!code) return;
  const room = rooms.get(code);
  const fg = room && room.fg;
  if (fg) {
    const player = fg.players.get(ws);
    fg.players.delete(ws);
    const slot = fgSlotOf(fg, ws);
    if (slot === 'a') fg.slotA = null;
    if (slot === 'b') fg.slotB = null;
    if (slot) {
      // The pairing just changed — any in-progress match no longer means anything (the departed
      // duelist's opponent shouldn't keep a lead built against someone who isn't there anymore).
      clearTimeout(fg.timer);
      fg.phase = 'waiting';
      fg.scoreA = 0;
      fg.scoreB = 0;
      fg.roundNumber = 0;
      // Promote the longest-waiting spectator (Map iteration order is insertion order) into the
      // now-empty slot, same "first queued, first up" fairness every other queue-based feature in
      // this app uses.
      for (const [otherWs, otherP] of fg.players) {
        if (fgSlotOf(fg, otherWs)) continue;
        if (slot === 'a') fg.slotA = otherWs; else fg.slotB = otherWs;
        broadcastFg(code, { type: 'fg-slot-filled', slot, id: otherP.id, name: otherP.name });
        break;
      }
    }
    if (player) broadcastFg(code, { type: 'fg-player-left', id: player.id });
    if (player) clearRoomActivity(code, player.name);
    if (fg.players.size === 0) { clearTimeout(fg.timer); delete room.fg; }
  }
  ws.fgRoom = null;
  ws.fgId = null;
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

// Found by the turn-based-minigame UI correctness audit: this used to return just the winning
// symbol, discarding exactly which cells actually formed the winning run — so the client had no
// win-line highlight to render at all, just the generic "everyone dims" treatment, making it
// genuinely hard to spot which four disks connected on the larger Connect Four board. Now also
// returns the matched run's own coordinates when there is one.
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
        if (count >= winLength) {
          const cells = [];
          for (let i = 0; i < winLength; i++) cells.push((row + dr * i) * width + (col + dc * i));
          return { symbol: sym, cells };
        }
      }
    }
  }
  if (board.every((c) => c)) return { symbol: 'draw', cells: null };
  return null;
}

function ttPublicState(tt) {
  return {
    mode: tt.mode,
    board: tt.board,
    turn: tt.turn,
    winner: tt.winner,
    winCells: tt.winCells || null,
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
    // Strokes are already persisted (db.getWhiteboardStrokes rehydrates them on the next wb-join),
    // so it's safe to drop this in-memory session once nobody's left drawing — otherwise the
    // cached stroke array (up to 3000 entries) stays resident for as long as the room itself does,
    // same pattern leaveBc/leaveTv/leaveDg already use.
    if (room.wb.players.size === 0) delete room.wb;
  }
  ws.wbRoom = null;
}

// Found by a room-host/moderation-powers audit: every host-only check in this file used to compare
// dbRoom.host_name === ws.profile.name directly — host_name is a client-supplied, unauthenticated
// display-name string with no uniqueness enforcement, so anyone who simply typed the exact same
// display name as the host would pass every one of these checks too. Concretely: join-room's
// same-name eviction (below, "Reconnected from another tab") has no account check, so an attacker
// could join as "<hostName>", force-disconnect the real host's live session, and have their OWN
// connection now match host_name — full host powers (kick/mute/ban, rename, announcement,
// wallpaper, pin, unban) with the real host actively locked out, not just impersonating an absent
// one. Fixed by keying off host_account_id (set at room creation when the creator is signed in —
// see setRoomHostIfUnset) whenever it's present: a display name can never satisfy that, since it
// requires ws.accountId to match a durable account id, not a string. A guest-created room (no
// account, host_account_id stays NULL) has no durable identity to key off at all and keeps the
// original name-only check — an accepted, explicitly-documented trust model already ("no accounts
// to actually verify identity"), not something this fix can or should change.
function isRoomHost(dbRoom, ws) {
  if (!dbRoom) return false;
  if (dbRoom.host_account_id) return ws.accountId === dbRoom.host_account_id;
  return dbRoom.host_name === ws.profile.name;
}

// Shared by kick-user/mute-user/ban-user (host check + target-name parsing + in-memory room
// lookup) — was copy-pasted verbatim at all three call sites. unmute-user isn't included: its
// shape genuinely differs (no empty/self-name guard, doesn't bail if the room is already gone),
// so folding it in here would risk a subtle behavior change rather than a pure extraction.
function resolveModerationTarget(ws, msg) {
  // Shared by kick/mute/ban — host-only, but a flood still costs a synchronous DB write plus a
  // full room broadcast every call, blocking the shared event loop for every room on the server,
  // not just the attacker's own.
  if (isWsMsgRateLimited(ws)) return null;
  const dbRoom = db.getRoom(ws.room);
  if (!isRoomHost(dbRoom, ws)) return null;
  const targetName = String(msg.name || '').trim();
  if (!targetName || targetName === ws.profile.name) return null;
  const room = rooms.get(ws.room);
  if (!room) return null;
  return { dbRoom, room, targetName };
}

wss.on('connection', (ws, req) => {
  // Paired with the heartbeat setInterval above — a client starts "alive" so it survives until the
  // first ping cycle, and any real pong response (browsers/ws clients answer pings automatically,
  // no application code involved) refreshes it.
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  // Registered before anything else, including the connect-rate-limit check right below that can
  // close the connection immediately — without a listener for the 'error' event, Node's
  // EventEmitter throws an unhandled 'error' as an uncaught exception, which escapes past any
  // try/catch (this happens at the stream/frame level, not application code) into the
  // process-level uncaughtException handler near the top of this file, which deliberately calls
  // process.exit(1) — turning ONE bad frame from ANY connected client into a crash of the entire
  // server for every single connected user. Registering this any later left a real gap: a
  // connection rejected by isWsConnectRateLimited below (closed before this line used to run) had
  // no error protection at all during its own rejection.
  ws.on('error', (err) => {
    // reportError itself does a synchronous DB write — if that throws (locked/corrupted DB, disk
    // full, whatever), the exception would propagate back out through ws's own internal emit()
    // call stack rather than through this file's application code, right back to the exact
    // uncaught-exception crash this handler exists to prevent. try/catch this specific call so a
    // failure to *log* the error can never itself become the crash.
    try {
      reportError('server', err, { wsConnectionError: true });
    } catch {
      // Deliberately swallowed — see comment above.
    }
  });
  // Only used to defend against a single IP claiming an outsized share of one stream's
  // viewer slots (see MAX_SCORPTURE_VIEWERS_PER_IP below) — 'trust proxy' above only affects
  // req.ip on HTTP routes, not this raw upgrade request, so the X-Forwarded-For header (set by
  // the same local reverse proxy) is read directly here. isFromTrustedProxy (see its own comment
  // near 'trust proxy' above) gates that read the same way Express's own trust-proxy setting
  // would — without it, a direct connection to this port could forge X-Forwarded-For outright.
  const xff = isFromTrustedProxy(req.socket.remoteAddress) ? req.headers['x-forwarded-for'] : null;
  ws._ip = (xff ? xff.split(',')[0].trim() : null) || req.socket.remoteAddress || 'unknown';
  if (isWsConnectRateLimited(ws._ip)) {
    ws.close(1013, 'Too many connections too quickly — slow down a bit.');
    return;
  }
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    // JSON.parse("null") succeeds and returns null (not caught above) — every dispatch check
    // below assumes msg is an object and reads msg.type unconditionally, which throws on null
    // (and would throw the same way on a bare number/string/boolean, though only null is valid
    // JSON that isn't also a plain object/array). That throw used to escape uncaught (the catch
    // block further down reads msg.type on the same null a second time while building its error
    // context, throwing again with nothing left to catch it) straight into the process-level
    // uncaughtException handler, which calls process.exit(1) — a single `ws.send("null")` from
    // any connected client killed the entire server for every room/user, not just that connection.
    if (!msg || typeof msg !== 'object') return;

    // The entire dispatch below is one big try/catch: a bug in any single message handler
    // must not kill this connection's message loop (or, since all clients share one process,
    // every other connection too). See reportError() near the top of this file.
    try {
    if (msg.type === 'join-server') {
      // No rate limit here meant any client (no prior room join needed — this is the very first
      // message a connection can send) could flood broadcastWorldwideCount() below, which does
      // two full passes over every connected client on the whole server, not just one room.
      if (isWsMsgRateLimited(ws)) return;
      const name = String(msg.username || 'Anonymous').slice(0, 30).trim() || 'Anonymous';
      const saved = db.getProfile(name);
      ws.profile = {
        name,
        sub: crypto.randomUUID(),
        avatarUrl: saved ? saved.avatar_url : null,
        status: saved ? saved.status : null,
      };
      // Found by the landing/room-join-flow correctness audit: an expired/invalid accountToken
      // was silently ignored here — the client never learned its token was rejected, so its
      // account panel/menu kept showing "signed in" indefinitely while cross-device sync,
      // friends, and push silently did nothing. accountTokenInvalid (only true when a token was
      // actually supplied but didn't resolve to a real session, never merely "no token sent") lets
      // the client clear its stale local token and re-render as signed-out instead of leaving that
      // misleading zombie state up.
      let accountTokenInvalid = false;
      if (msg.accountToken) {
        const account = db.getSessionAccount(String(msg.accountToken));
        if (account) registerAccountConnection(ws, account.id);
        else accountTokenInvalid = true;
      }
      send(ws, { type: 'joined-server', profile: ws.profile, accountTokenInvalid });
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
      // Fans out a real push notification to every subscriber on every call (notifyScorptureSubscribers
      // below) — same reason POST /api/scorpture/videos gates this with isPostMediaRateLimited.
      if (isWsMsgRateLimited(ws)) return;
      const title = String(msg.title || 'Untitled stream').slice(0, 100).trim() || 'Untitled stream';
      const account = db.getAccountById(ws.accountId);
      if (!account) return;
      // A stale tab still registered as this account's live stream (e.g. a second tab, or this
      // same tab calling go-live again after a reconnect) must be properly torn down — its
      // viewers notified via endScorptureLive — before this one takes over. Without this, the
      // stale tab's later close/end-live would blow away *this* stream's viewers instead of its
      // own, since both were only ever keyed by accountId with no way to tell tabs apart.
      if (liveStreams.has(ws.accountId)) endScorptureLive(ws.accountId);
      liveStreams.set(ws.accountId, { ws, username: account.username, title, startedAt: Date.now(), viewers: new Map(), viewerIps: new Map() });
      send(ws, { type: 'scorpture-go-live-ack', ok: true });
      notifyScorptureSubscribers(ws.accountId, { title: `${account.username} is live`, body: title });
      return;
    }

    if (msg.type === 'scorpture-end-live') {
      // Only end the stream if this connection is the one actually on file — a stale/superseded
      // tab (see scorpture-go-live above) explicitly ending "its" stream must not tear down a
      // newer one that already replaced it.
      if (ws.accountId) {
        const stream = liveStreams.get(ws.accountId);
        if (stream && stream.ws === ws) endScorptureLive(ws.accountId);
      }
      return;
    }

    if (msg.type === 'scorpture-watch-live') {
      // Rate-limited (not scorpture-leave-live, its counterpart below — that one only ever does
      // cleanup, and throttling it risks leaving stream.viewers/viewerIps stuck over-counted,
      // defeating the very cap this is meant to protect). Without this, a single connection
      // could loop watch→leave against one streamer as fast as the network allows, each cycle
      // forcing that streamer's browser to open/close a fresh RTCPeerConnection — an
      // unauthenticated DoS against a specific broadcaster's tab.
      if (isWsMsgRateLimited(ws)) return;
      const streamerAccount = db.getAccountByUsername(String(msg.streamerUsername || '').trim());
      const stream = streamerAccount ? liveStreams.get(streamerAccount.id) : null;
      if (!stream) {
        send(ws, { type: 'scorpture-watch-ack', live: false });
        return;
      }
      // Watching is anonymous-by-design (no sign-in required), but a signed-in viewer who's
      // blocked (either direction) shouldn't be able to watch/signal with this streamer at all —
      // same block enforcement every other cross-account channel already respects.
      if (ws.accountId && db.isBlockedBetween(streamerAccount.id, ws.accountId)) {
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
      // No sign-in is required to watch (by design — anonymous spectating), so there's nothing
      // to rate-limit auth attempts against; instead cap concurrent viewer slots per IP so one
      // machine can't force the streamer's browser to open hundreds of RTCPeerConnections or eat
      // a large share of the global MAX_SCORPTURE_VIEWERS budget.
      const viewerIp = ws._ip || 'unknown';
      const ipCount = stream.viewerIps.get(viewerIp) || 0;
      if (ipCount >= MAX_SCORPTURE_VIEWERS_PER_IP) {
        send(ws, { type: 'scorpture-watch-ack', live: false });
        return;
      }
      stream.viewerIps.set(viewerIp, ipCount + 1);
      ws._scorptureViewerIp = viewerIp;
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
      // Real signaling traffic is naturally low-volume (a handful of SDP/ICE messages per call
      // setup), so this is cheap insurance rather than a load-bearing limit — but it was missing
      // entirely, unlike every other WS path that relays content to another connection.
      if (isWsMsgRateLimited(ws)) return;
      // A single connection can be simultaneously live (broadcasting) AND watching someone else's
      // stream (the mini-widget lets you keep your own stream running while browsing elsewhere) —
      // ws.scorptureStreamerAccountId being set doesn't mean every scorpture-signal this connection
      // sends is viewer-to-broadcaster traffic. msg.viewerId is only ever set by a broadcaster
      // addressing one specific viewer of its own (see the comment above), so check that first and
      // only fall back to "I'm a viewer, forward to the streamer I'm watching" when it's absent.
      // Previously the viewer branch fired unconditionally whenever scorptureStreamerAccountId was
      // set, silently rerouting a simultaneous broadcaster's own outbound signaling to whichever
      // OTHER stream they were watching instead of to their real viewers — any viewer joining
      // during that window never received an SDP offer/ICE candidate and was stuck on an eternal
      // "connecting" spinner, with no error anywhere.
      if (ws.accountId && msg.viewerId) {
        const stream = liveStreams.get(ws.accountId);
        // Gate on this actually being the stream's on-file connection, not just "same account as
        // the broadcaster" — mirrors the check scorpture-end-live already uses. Without it, a
        // second tab/device signed into the same account as an active broadcaster could inject
        // signaling into that stream's real viewers despite not holding their RTCPeerConnections
        // (self-harm only — glitches your own stream's negotiation, can't reach another account's
        // stream — but the same-tab-only invariant is worth enforcing consistently, not just here).
        const viewerWs = stream && stream.ws === ws && stream.viewers.get(msg.viewerId);
        if (viewerWs) send(viewerWs, { type: 'scorpture-signal', signal: msg.signal });
        return;
      }
      if (ws.scorptureStreamerAccountId) {
        const stream = liveStreams.get(ws.scorptureStreamerAccountId);
        if (stream) send(stream.ws, { type: 'scorpture-signal', viewerId: ws.scorptureViewerId, signal: msg.signal });
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
      const streamerAccountId = ws.scorptureStreamerAccountId || ws.accountId;
      const stream = liveStreams.get(streamerAccountId);
      if (!stream) return;
      // Same block enforcement every other cross-account channel already respects — a no-op when
      // streamerAccountId is this same sender's own id (the broadcaster chatting in their own
      // stream), since an account can't be blocked with itself.
      if (db.isBlockedBetween(ws.accountId, streamerAccountId)) return;
      // Same flood gate as regular chat/DM messages — was missing here, letting an unthrottled
      // viewer spam every other viewer + the streamer at unlimited speed.
      if (isWsMsgRateLimited(ws)) return;
      const chatMsg = { type: 'scorpture-live-chat', username: account.username, text, at: Date.now() };
      send(stream.ws, chatMsg);
      for (const viewerWs of stream.viewers.values()) send(viewerWs, chatMsg);
      return;
    }

    // Build Craft and Geometry Wave each open their own WebSocket connection from their own page
    // (not the chat page), so these never go through 'join-server' / ws.profile — handled here,
    // before the chat-identity gate below.
    if (msg.type === 'bc-join') {
      // Every *-join handler funnels into getOrCreateRoom (real DB writes, can manufacture a
      // brand-new room+world from any arbitrary code) and setRoomActivity (another DB write plus
      // a full room broadcast) with zero prior dedup — a raw client resending this could flood
      // both at the raw message rate. Same shared gate every other write/broadcast path uses.
      if (isWsMsgRateLimited(ws)) return;
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      const color = /^#[0-9a-fA-F]{6}$/.test(msg.color || '') ? msg.color : '#2fb6ac';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'bc-join-error', message: "You've been banned from this room" });
        return;
      }
      // Without this, a second bc-join on the same connection for a different room overwrites
      // ws.bcRoom without ever removing this ws from the OLD room's bc.players Map — same class of
      // bug fg-join's own comment documents. The stale entry is unreachable (its ws no longer
      // reports ws.bcRoom === that room), so real disconnect cleanup never finds it, permanently
      // pinning that old room's whole state (chat history, voice, every other minigame) in memory.
      if (ws.bcRoom === code) return;
      if (ws.bcRoom) leaveBc(ws);
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
        // Claims are now persisted (see db.js's bc_claims table comment) -- previously always
        // started as [] here, so any claim made in a session silently vanished once the room's
        // last player left and this branch ran again on the next join.
        room.bc = { seed: world.seed, overrides: new Map(db.getBcOverrides(code)), players: new Map(), dayNightOffsetMs: 0, sleeping: new Set(), claims: db.getBcClaims(code) };
      }
      if (room.bc.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'bc-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.bcRoom = code;
      ws.bcId = id;
      // A stable per-browser id (localStorage-generated, see buildcraft.js) used for land-claim
      // ownership instead of display name — two players sharing a name (plausible with the
      // default "Player") used to treat each other's claims as their own. Optional: an older
      // client that hasn't picked this up yet just falls back to the legacy name-based check.
      const stableId = typeof msg.playerId === 'string' ? msg.playerId.slice(0, 64) : null;
      const players = [...room.bc.players.values()].map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, health: p.health, color: p.color, armorTier: p.armorTier || null }));
      // gameMode starts unset (treated as survival by applyBcDamage) — bc-join fires the instant
      // the socket opens, before the player has actually picked Creative/Survival on the start
      // screen; the real value arrives moments later via bc-set-mode once they click a mode.
      room.bc.players.set(ws, { id, name, stableId, x: 0, y: 2.4, z: 0, yaw: 0, health: BC_MAX_HEALTH, lastPunchAt: 0, lastDamageAt: 0, armorReduction: 0, armorTier: null, color, gameMode: null });
      send(ws, {
        type: 'bc-init',
        id,
        seed: room.bc.seed,
        overrides: [...room.bc.overrides.entries()],
        players,
        dayNightOffsetMs: room.bc.dayNightOffsetMs || 0,
        claims: (room.bc.claims || []).map((c) => bcClaimForClient(c, { stableId, name })),
      });
      broadcastBc(code, { type: 'bc-player-joined', id, name, color }, ws);
      setRoomActivity(code, name, 'bc');
      return;
    }

    if (msg.type === 'bc-block' && ws.bcRoom) {
      // Unlike bc-pos (which got the same isStrokeRateLimited gate for the same reason — the
      // standard chat gate is too tight for legitimate fast play), buildcraft.js sends one
      // bc-block per break/place with no client-side batching/throttling, so a fast player mining
      // several blocks in quick succession is real, expected traffic, not just an attacker.
      if (isStrokeRateLimited(ws)) return;
      const room = rooms.get(ws.bcRoom);
      if (!room || !room.bc) return;
      // Land-claim protection was previously enforced client-side only (buildcraft.js's own
      // isCellClaimedByOther checks before ever sending bc-block) — a raw WS client bypassing
      // that JS entirely (or a modified build) could ignore claims completely, since this handler
      // never checked them itself. `me` may be undefined for a connection that reconnected
      // mid-session without a fresh bc-join; in that case fall back to rejecting any claimed cell
      // outright rather than risking a false "it's mine" match via bcClaimOwnedBy.
      const me = room.bc.players.get(ws);
      const claims = room.bc.claims || [];
      const isClaimedByOther = (x, z) => claims.some((c) => (!me || !bcClaimOwnedBy(c, me)) && Math.hypot(x - c.x, z - c.z) <= c.radius);
      const rawChanges = Array.isArray(msg.changes) ? msg.changes.slice(0, 2000) : [];
      const validChanges = [];
      const persistEntries = [];
      for (const c of rawChanges) {
        const type = (c.t === null || c.t === undefined) ? null : (c.t | 0);
        if (type !== null && (type < 0 || type > BC_MAX_BLOCK_TYPE)) continue;
        // Block type already had this bound (BC_MAX_BLOCK_TYPE) but the coordinates themselves
        // didn't, unlike every other position field in this game (bc-pos, gw-pos, sw-pos all
        // clamp to BC_MAX_COORD) -- an out-of-range override persists to SQLite forever and grows
        // every future joiner's bc-init payload, so reject rather than clamp (a clamp would still
        // let someone pile up thousands of garbage entries at the boundary).
        const bx = c.x | 0, by = c.y | 0, bz = c.z | 0;
        if (Math.abs(bx) > BC_MAX_COORD || Math.abs(by) > BC_MAX_COORD || Math.abs(bz) > BC_MAX_COORD) continue;
        if (isClaimedByOther(bx, bz)) continue;
        const key = `${bx},${by},${bz}`;
        room.bc.overrides.set(key, type);
        persistEntries.push([key, type]);
        validChanges.push({ x: bx, y: by, z: bz, t: type });
      }
      if (persistEntries.length) db.setBcOverrides(ws.bcRoom, persistEntries);
      // Evict oldest-changed cells once over BC_MAX_OVERRIDES — Map iteration order is insertion
      // order, so the first keys() are the longest-standing overrides. Mirrored in the DB by
      // setBcOverrides itself (see db.js) so a room that empties out and reloads from disk can't
      // resurrect the unbounded pre-cap history.
      while (room.bc.overrides.size > BC_MAX_OVERRIDES) {
        room.bc.overrides.delete(room.bc.overrides.keys().next().value);
      }
      if (validChanges.length) broadcastBc(ws.bcRoom, { type: 'bc-block', changes: validChanges }, ws);
      return;
    }

    if (msg.type === 'bc-pos' && ws.bcRoom) {
      // No throttle at all before this — a raw WS client ignoring buildcraft.js's own 120ms
      // client-side send throttle (updateBcPosBroadcast) could flood the whole room with
      // position broadcasts. The standard chat gate (isWsMsgRateLimited, ~1.3/sec) would be far
      // too tight for legitimate use here — position streams are meant to run much faster than
      // chat — so this reuses isStrokeRateLimited (20/sec) instead, the same "faster than chat
      // but still bounded" gate whiteboard/Pictionary strokes already use, which comfortably
      // covers the real ~8/sec (120ms) legitimate rate with headroom for jitter.
      if (isStrokeRateLimited(ws)) return;
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
      const bc = room && room.bc;
      if (!bc) return;
      const attacker = bc.players.get(ws);
      if (!attacker || attacker.health <= 0) return;
      const now = Date.now();
      if (now - (attacker.lastPunchAt || 0) < BC_PUNCH_COOLDOWN_MS) return;
      // Set as soon as the cooldown itself clears, not only once a punch actually connects — a
      // punch that misses (bad targetId, dead target, out of range) still cost the attacker their
      // swing in a real fight, and this is what makes the cooldown check above actually throttle
      // the message rate. Setting it only on a landed hit left every miss free: a raw WS client
      // spamming bc-punch at a target it knows is out of range paid no cooldown at all, an
      // unthrottled flood of messages (same bug independently found and fixed in fg-shoot/
      // sw-strike, which used to follow this exact same shape).
      attacker.lastPunchAt = now;

      let targetWs = null;
      let target = null;
      for (const [w, p] of bc.players) {
        if (p.id === msg.targetId) { targetWs = w; target = p; break; }
      }
      if (!target || target.health <= 0) return;
      // Loose sanity check against each side's last-reported position — positions here are
      // trust-the-client (same as every other bc-pos-driven thing), this just stops a wildly
      // out-of-range punch, not a fully server-validated hit.
      const dx = attacker.x - target.x, dy = attacker.y - target.y, dz = attacker.z - target.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > BC_PUNCH_RANGE + 3) return;

      applyBcDamage(ws.bcRoom, targetWs, target, 1, attacker.id);
      return;
    }

    if (msg.type === 'bc-fall-damage' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const bc = room && room.bc;
      const me = bc && bc.players.get(ws);
      if (!me || me.health <= 0) return;
      // Only ever damages the sender's own health (byId: null), so unlike bc-punch this can't
      // directly harm another player — but applyBcDamage broadcasts a real bc-hit to the whole
      // room on every call, and this had no cooldown at all, unlike bc-punch's dedicated one. A
      // raw WS client spamming this was a room-wide broadcast flood, not just self-harm.
      if (isWsMsgRateLimited(ws)) return;
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
      // Unlike bc-claim/dg-start/tv-start (naturally bounded by a per-player cap or "can't
      // restart an active round"), this and bc-set-skin below have no such natural limit — a
      // cosmetic/loadout choice can be toggled at will, with a room-wide broadcast every time.
      if (isWsMsgRateLimited(ws)) return;
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
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.bcRoom);
      const me = room && room.bc && room.bc.players.get(ws);
      if (!me || !/^#[0-9a-fA-F]{6}$/.test(msg.color || '')) return;
      me.color = msg.color;
      broadcastBc(ws.bcRoom, { type: 'bc-skin-changed', id: me.id, color: me.color }, ws);
      return;
    }

    if (msg.type === 'bc-claim' && ws.bcRoom) {
      // Found by an unbounded-memory-growth audit: bc-claim was the one bc-* handler with no
      // flood gate at all (every sibling — bc-pos/bc-block via isStrokeRateLimited, bc-sleep/
      // bc-wake/bc-set-armor/bc-set-skin via isWsMsgRateLimited — has one).
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.bcRoom);
      const bc = room && room.bc;
      const me = bc && bc.players.get(ws);
      if (!bc || !me) return;
      if (!bc.claims) bc.claims = [];
      // Same audit: BC_MAX_CLAIMS_PER_PLAYER alone doesn't bound room.bc.claims' total size — it's
      // keyed on a client-supplied stableId (bc-join), so a connection cycling through fresh
      // stableIds resets its own count to zero every time, letting claims grow without bound. A
      // room-wide ceiling closes that regardless of how ownership is being computed.
      if (bc.claims.length >= BC_MAX_ROOM_CLAIMS) {
        send(ws, { type: 'bc-claim-denied' });
        return;
      }
      const ownedCount = bc.claims.filter((c) => bcClaimOwnedBy(c, me)).length;
      if (ownedCount >= BC_MAX_CLAIMS_PER_PLAYER) {
        send(ws, { type: 'bc-claim-denied' });
        return;
      }
      const claimX = Math.max(-BC_MAX_COORD, Math.min(BC_MAX_COORD, Math.floor(+msg.x || 0)));
      const claimZ = Math.max(-BC_MAX_COORD, Math.min(BC_MAX_COORD, Math.floor(+msg.z || 0)));
      const claim = { x: claimX, z: claimZ, radius: BC_CLAIM_RADIUS, owner: me.name, ownerId: me.stableId || null };
      bc.claims.push(claim);
      db.addBcClaim(ws.bcRoom, claim.x, claim.z, claim.radius, claim.owner, claim.ownerId);
      // Per-recipient, not broadcastBc's single shared payload — isMine differs per viewer (see
      // bcClaimForClient's own comment).
      for (const [client, p] of bc.players) {
        if (client.readyState === client.OPEN) send(client, { type: 'bc-claim-added', ...bcClaimForClient(claim, p) });
      }
      return;
    }

    if (msg.type === 'bc-sleep' && ws.bcRoom) {
      // A toggle like bc-wake below, not a continuous stream like bc-pos — the standard gate.
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.bcRoom);
      const bc = room && room.bc;
      const me = bc && bc.players.get(ws);
      if (!bc || !me) return;
      if (!bc.sleeping) bc.sleeping = new Set();
      bc.sleeping.add(ws);
      broadcastBc(ws.bcRoom, { type: 'bc-sleep-count', sleeping: bc.sleeping.size, total: bc.players.size });
      checkBcSleepConsensus(ws.bcRoom, bc);
      return;
    }

    if (msg.type === 'bc-wake' && ws.bcRoom) {
      if (isWsMsgRateLimited(ws)) return; // see bc-sleep's comment on this same guard
      const room = rooms.get(ws.bcRoom);
      const bc = room && room.bc;
      if (!bc || !bc.sleeping) return;
      bc.sleeping.delete(ws);
      broadcastBc(ws.bcRoom, { type: 'bc-sleep-count', sleeping: bc.sleeping.size, total: bc.players.size });
      return;
    }

    if (msg.type === 'bc-eat' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const bc = room && room.bc;
      const me = bc && bc.players.get(ws);
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
      const bc = room && room.bc;
      const me = bc && bc.players.get(ws);
      if (!bc || !me) return;
      if (isWsMsgRateLimited(ws)) return; // see voice-join's comment on this same guard
      if (!bc.voice) bc.voice = new Map();
      const existing = [...bc.voice.entries()].map(([id, p]) => ({ id, name: p.name }));
      bc.voice.set(ws.bcId, { ws, name: me.name });
      send(ws, { type: 'bc-voice-peers', peers: existing });
      for (const [id, p] of bc.voice) {
        if (id !== ws.bcId) send(p.ws, { type: 'bc-voice-peer-joined', id: ws.bcId, name: me.name });
      }
      return;
    }

    if (msg.type === 'bc-voice-signal' && ws.bcRoom) {
      const room = rooms.get(ws.bcRoom);
      const voice = room && room.bc && room.bc.voice;
      // Mirrors voice-signal's own check: without this, anyone in the Build Craft room (never
      // having sent bc-voice-join) could forge a signal to a real voice participant's id.
      if (!voice || !voice.has(ws.bcId)) return;
      if (isStrokeRateLimited(ws)) return; // see voice-signal's comment on this same guard
      const target = voice.get(String(msg.to || ''));
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
      // Same mute check every other free-text broadcast in this app respects (room chat, DMs) —
      // Build Craft's in-game chat is functionally identical (arbitrary text, broadcast to
      // everyone present) and was letting a muted user route around their mute by opening it.
      if (room.muted && room.muted.has(me.name)) return;
      const text = String(msg.text || '').slice(0, 300).trim();
      if (!text) return;
      // Same flood gate every other chat-creation path in this app shares (room chat, DMs,
      // group DMs, Scorpture live chat) — Build Craft's in-game chat was missing it.
      if (isWsMsgRateLimited(ws)) return;
      broadcastBc(ws.bcRoom, { type: 'bc-chat', name: me.name, text });
      return;
    }

    if (msg.type === 'bc-blueprint-save' && ws.bcRoom) {
      // Each call does a JSON.stringify + DB insert on up to 20,000 block entries, with no cap
      // on how many blueprints one player can save — the standard gate at least bounds the rate.
      if (isWsMsgRateLimited(ws)) return;
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
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const level = String(msg.level || 'easy').slice(0, 20);
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'gw-join-error', message: "You've been banned from this room" });
        return;
      }
      // See bc-join's comment on this same guard — a second gw-join for a different room/level
      // combo would otherwise overwrite ws.gwRoom/ws.gwLevel without ever clearing this ws from
      // the OLD level session's players Map, orphaning it (and everything that keeps that room
      // resident) forever. Sessions here are addressed by code+level together, so both must match
      // to skip re-joining.
      if (ws.gwRoom === code && ws.gwLevel === level) return;
      if (ws.gwRoom) leaveGw(ws);
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
      // Same reasoning as bc-pos above — no throttle before this, and the standard chat gate
      // would be too tight for a real-time position stream (legitimate client throttle is 100ms,
      // ~10/sec).
      if (isStrokeRateLimited(ws)) return;
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
      const percent = Math.max(0, Math.min(100, Math.floor(+msg.percent || 0)));
      if (!level || !percent) return;
      // Found by the leaderboard/score-submission-integrity audit: name used to come straight from
      // the client message, unlike every sibling game's submit path (arcade-submit-score, sw-score,
      // and every server-authoritative game's own bumpLeaderboard call all key off the session's
      // own tracked name) — a raw WS client could plant a leaderboard entry under ANY name,
      // including impersonating a real other player. Now reads the session-tracked name gw-join
      // already recorded, the same pattern every other game uses. Score-magnitude fakery itself
      // remains an accepted tradeoff (see below), same as arcade-submit-score/sw-score — this fix
      // is specifically about attribution, not about validating gameplay.
      const gwSession = rooms.get(ws.gwRoom)?.gw?.get(ws.gwLevel);
      const gwPlayer = gwSession?.players?.get(ws);
      if (!gwPlayer) return;
      const name = gwPlayer.name;
      // Fully client-computed like arcade-submit-score (Snake/2048/Fighter Plane) — anyone can
      // fire a gw-complete frame directly to plant a fake leaderboard entry. Reuses that same
      // submission-cooldown mitigation, but deliberately NOT the min-session-time half of it:
      // unlike arcade-join (fires on page load), gw-join fires right when startLevel() actually
      // starts play, so a genuinely fast clear of a short/easy hand-built level could be well
      // under the 3s threshold that's safe for the arcade games — a false block on a real score
      // is worse than leaving this particular gap only partially covered.
      const nowGw = Date.now();
      if (nowGw - (ws.lastGwSubmitAt || 0) < ARCADE_SUBMIT_COOLDOWN_MS) return;
      ws.lastGwSubmitAt = nowGw;
      db.bumpLeaderboard(ws.gwRoom, `gw-${level}`, name, percent);
      return;
    }

    if (msg.type === 'gw-leaderboard') {
      // Deliberately not gated on ws.gwRoom (an active session) — the level-select screen wants
      // to show a leaderboard before joining any level, same as it already shows local best %.
      // Same missing-flood-gate fix as tv-leaderboard above (found by the leaderboard-integrity
      // audit — this and sw-leaderboard/fg-leaderboard were the 3 of 9 sibling read handlers this
      // exact gate was never added to in that earlier sweep).
      if (isWsMsgRateLimited(ws)) return;
      const code = String(msg.code || '').toUpperCase().trim();
      const level = String(msg.level || '').slice(0, 20);
      if (!code || !level) return;
      send(ws, { type: 'gw-leaderboard-result', level, scores: db.getLeaderboard(code, `gw-${level}`, 10) });
      return;
    }

    if (msg.type === 'sw-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'sw-join-error', message: "You've been banned from this room" });
        return;
      }
      if (ws.swRoom === code) return; // see bc-join's comment on this same guard
      if (ws.swRoom) leaveSw(ws);
      const room = getOrCreateRoom(code);
      if (!room.sw) room.sw = { players: new Map() };
      if (room.sw.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'sw-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.swRoom = code;
      ws.swId = id;
      ws.swJoinedAt = Date.now();
      const players = [...room.sw.players.values()].map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw }));
      room.sw.players.set(ws, { id, name, x: 0, y: 0, z: 0, yaw: 0, health: SW_MAX_HEALTH, lastStrikeAt: 0, respawnedAt: 0 });
      send(ws, { type: 'sw-init', id, players, health: SW_MAX_HEALTH });
      broadcastSw(code, { type: 'sw-player-joined', id, name }, ws);
      setRoomActivity(code, name, 'sw');
      return;
    }

    if (msg.type === 'sw-pos' && ws.swRoom) {
      // Same reasoning as bc-pos above — no throttle before this, and the standard chat gate
      // would be too tight for a real-time position stream (legitimate client throttle is 100ms,
      // ~10/sec).
      if (isStrokeRateLimited(ws)) return;
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

    // Web strike — PvP combat. Same shape as bc-punch: a cooldown, a loose position-based range
    // check (not authoritative geometry, matching this game's existing trust-the-client position
    // model), then a direct health decrement with a broadcast death/respawn on elimination.
    if (msg.type === 'sw-strike' && ws.swRoom) {
      const room = rooms.get(ws.swRoom);
      const session = room && room.sw;
      if (!session) return;
      const attacker = session.players.get(ws);
      if (!attacker || attacker.health <= 0) return;
      const now = Date.now();
      if (now - (attacker.lastStrikeAt || 0) < SW_STRIKE_COOLDOWN_MS) return;
      // Set right after the cooldown check clears, not only on a landed hit — see the identical
      // fix (and its full explanation) on bc-punch above; a miss (self-target, dead target,
      // respawn grace, out of range) used to cost nothing, leaving this cooldown check trivially
      // bypassable by spamming sw-strike at a target it knows won't connect.
      attacker.lastStrikeAt = now;

      if (msg.targetId === attacker.id) return;
      let target = null;
      for (const p of session.players.values()) {
        if (p.id === msg.targetId) { target = p; break; }
      }
      if (!target || target.health <= 0) return;
      if (now - (target.respawnedAt || 0) < SW_RESPAWN_GRACE_MS) return;
      const dx = attacker.x - target.x, dy = attacker.y - target.y, dz = attacker.z - target.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > SW_STRIKE_RANGE) return;

      target.health -= 1;
      if (target.health > 0) {
        broadcastSw(ws.swRoom, { type: 'sw-hit', targetId: target.id, health: target.health, byId: attacker.id });
        return;
      }
      target.health = SW_MAX_HEALTH;
      target.respawnedAt = now;
      broadcastSw(ws.swRoom, { type: 'sw-death', id: target.id, killedBy: attacker.id, health: SW_MAX_HEALTH });
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
      // Fully client-computed like gw-complete/arcade-submit-score above — same submission-cooldown
      // mitigation reused here; this was the one leaderboard-writing message left with no cooldown
      // at all, letting a client hammer db.bumpLeaderboard with unbounded writes.
      const nowSw = Date.now();
      // Unlike gw-complete (deliberately skips this — see its own comment on why a short
      // hand-built level can legitimately clear in under 3s), Web Swing's score is an accumulated
      // pickup/near-miss total with no realistic way to reach a large value instantly — the
      // cooldown alone let a fresh connection submit one arbitrary top-of-leaderboard score with
      // zero elapsed session time. Reuses arcade-submit-score's own min-session-time threshold.
      if (nowSw - (ws.swJoinedAt || 0) < ARCADE_SUBMIT_MIN_SESSION_MS) return;
      if (nowSw - (ws.lastSwSubmitAt || 0) < ARCADE_SUBMIT_COOLDOWN_MS) return;
      ws.lastSwSubmitAt = nowSw;
      db.bumpLeaderboard(ws.swRoom, 'sw', p.name, score);
      return;
    }

    if (msg.type === 'sw-leaderboard') {
      // Same missing-flood-gate fix as tv-leaderboard above (found by the leaderboard-integrity audit).
      if (isWsMsgRateLimited(ws)) return;
      const code = String(msg.code || '').toUpperCase().trim();
      if (!code) return;
      send(ws, { type: 'sw-leaderboard-result', scores: db.getLeaderboard(code, 'sw', 10) });
      return;
    }

    if (msg.type === 'fg-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'fg-join-error', message: "You've been banned from this room" });
        return;
      }
      // A connection already active in this exact session must never re-run slot assignment below
      // — fg.slotA/fg.slotB are only ever checked for truthiness ("is a slot open"), not "is this
      // someone else's connection", so a second fg-join on the same ws could otherwise claim BOTH
      // duelist slots for itself: fgSlotOf always resolves such a connection to 'a', so fg-shoot's
      // "target" would resolve back to the same entry as "attacker", guaranteeing every shot lands
      // (zero distance to itself) and letting it farm round/match wins and leaderboard kills solo
      // — the real client never does this (one fg-join per fresh connection), but a raw WS client
      // could, and it broke the whole "genuine 1v1" premise this feature was built for. Already
      // active in a *different* fg session just leaves that one first, same as a normal room switch.
      if (ws.fgRoom === code) return;
      if (ws.fgRoom) leaveFg(ws);
      const room = getOrCreateRoom(code);
      if (!room.fg) room.fg = { players: new Map(), slotA: null, slotB: null, phase: 'waiting', scoreA: 0, scoreB: 0, roundNumber: 0, roundEndAt: null, timer: null };
      const fg = room.fg;
      if (fg.players.size >= MAX_GAME_PLAYERS) {
        send(ws, { type: 'fg-full' });
        return;
      }
      const id = crypto.randomUUID();
      ws.fgRoom = code;
      ws.fgId = id;
      // lastShotAt is keyed per weapon, not one shared timestamp — the whole point of the 4-slot
      // loadout (see FG_WEAPONS) is switching mid-fight, and a single shared timestamp meant
      // firing the grenade (3200ms cooldown) used to lock out every *other* weapon for 3200ms too,
      // and firing anything else left the grenade still on someone else's cooldown clock.
      const entry = { id, name, x: 0, y: 0, z: 0, yaw: 0, health: FG_MAX_HEALTH, alive: false, weapon: FG_DEFAULT_WEAPON, kills: 0, deaths: 0, lastShotAt: {}, respawnedAt: 0 };
      fg.players.set(ws, entry);
      // First two players to ever join a fresh session become the duelists; everyone after that
      // queues as a spectator until a slot opens (see leaveFg's promotion logic).
      let role = 'spectator';
      if (!fg.slotA) { fg.slotA = ws; role = 'a'; }
      else if (!fg.slotB) { fg.slotB = ws; role = 'b'; }
      const totalKills = db.getFgKills(code, name);
      send(ws, {
        type: 'fg-init',
        id,
        role,
        weapons: FG_WEAPONS,
        maxHealth: FG_MAX_HEALTH,
        totalKills,
        unlockedWeapons: fgUnlockedWeapons(totalKills),
        players: [...fg.players.values()],
        slotAId: fg.slotA ? fg.players.get(fg.slotA).id : null,
        slotBId: fg.slotB ? fg.players.get(fg.slotB).id : null,
        phase: fg.phase,
        scoreA: fg.scoreA,
        scoreB: fg.scoreB,
        roundNumber: fg.roundNumber,
        endsAt: fg.roundEndAt,
      });
      broadcastFg(code, { type: 'fg-player-joined', id, name, role }, ws);
      setRoomActivity(code, name, 'fg');
      return;
    }

    if (msg.type === 'fg-start' && ws.fgRoom) {
      const room = rooms.get(ws.fgRoom);
      const fg = room && room.fg;
      if (!fg || fg.phase !== 'waiting' || !fg.slotA || !fg.slotB) return;
      startFgRound(ws.fgRoom);
      return;
    }

    if (msg.type === 'fg-select-weapon' && ws.fgRoom) {
      // Each call does a DB read (getFgKills) plus a room broadcast on success — no cap before.
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.fgRoom);
      const fg = room && room.fg;
      const p = fg && fg.players.get(ws);
      if (!p || !Object.prototype.hasOwnProperty.call(FG_WEAPONS, msg.weapon)) return;
      // Actually enforced here, not just hidden/greyed-out client-side — a raw WS client could
      // otherwise just send fg-select-weapon for a locked weapon directly and skip the unlock
      // requirement entirely.
      if (db.getFgKills(ws.fgRoom, p.name) < FG_WEAPONS[msg.weapon].unlockKills) return;
      p.weapon = msg.weapon;
      broadcastFg(ws.fgRoom, { type: 'fg-weapon-changed', id: p.id, weapon: p.weapon });
      return;
    }

    if (msg.type === 'fg-pos' && ws.fgRoom) {
      // Same reasoning as bc-pos/sw-pos/gw-pos above — real-time position stream, needs the
      // higher-throughput gate, not the tight chat-message one.
      if (isStrokeRateLimited(ws)) return;
      const room = rooms.get(ws.fgRoom);
      const p = room && room.fg && room.fg.players.get(ws);
      if (!p) return;
      const fgClamp = (n) => Math.max(-BC_MAX_COORD, Math.min(BC_MAX_COORD, +n || 0));
      p.x = fgClamp(msg.x); p.y = fgClamp(msg.y); p.z = fgClamp(msg.z); p.yaw = +msg.yaw || 0;
      broadcastFg(ws.fgRoom, { type: 'fg-pos', id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw }, ws);
      return;
    }

    if (msg.type === 'fg-shoot' && ws.fgRoom) {
      const room = rooms.get(ws.fgRoom);
      const fg = room && room.fg;
      if (!fg || fg.phase !== 'active') return;
      const attackerSlot = fgSlotOf(fg, ws);
      if (!attackerSlot) return; // only the two active duelists can deal damage — a queued spectator has nothing to shoot at
      const attacker = fg.players.get(ws);
      if (!attacker || !attacker.alive) return;
      const weapon = FG_WEAPONS[attacker.weapon] || FG_WEAPONS[FG_DEFAULT_WEAPON];
      const now = Date.now();
      if (now - (attacker.lastShotAt[attacker.weapon] || 0) < weapon.cooldownMs) return;
      // Set right after the cooldown check clears, not only on a landed hit — see the identical
      // fix (and its full explanation) on bc-punch above; a shot that misses (dead target,
      // respawn grace, out of range) used to cost nothing, leaving this cooldown check trivially
      // bypassable by spamming fg-shoot at a target known to be out of range.
      attacker.lastShotAt[attacker.weapon] = now;

      const targetWs = attackerSlot === 'a' ? fg.slotB : fg.slotA;
      // Defense in depth alongside fg-join's own guard above (which is what actually prevents
      // fg.slotA and fg.slotB ever being the same connection in the first place) — same
      // belt-and-suspenders self-target check sw-strike already has.
      if (targetWs === ws) return;
      const target = targetWs && fg.players.get(targetWs);
      if (!target || !target.alive) return;
      if (now - (target.respawnedAt || 0) < FG_RESPAWN_GRACE_MS) return;
      const dx = attacker.x - target.x, dy = attacker.y - target.y, dz = attacker.z - target.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > weapon.range) return;

      const headshot = !!msg.headshot && !!weapon.headshotDamage;
      const damage = headshot ? weapon.headshotDamage : weapon.damage;
      target.health = Math.max(0, target.health - damage);
      if (target.health > 0) {
        broadcastFg(ws.fgRoom, { type: 'fg-hit', targetId: target.id, health: target.health, byId: attacker.id, weapon: attacker.weapon, headshot });
        return;
      }
      target.alive = false;
      target.deaths += 1;
      attacker.kills += 1;
      broadcastFg(ws.fgRoom, { type: 'fg-death', id: target.id, killedBy: attacker.id, weapon: attacker.weapon, headshot });
      // Career total, not the in-memory per-match `attacker.kills` above — persists across matches
      // and reconnects (see fg_stats/bumpFgKills in db.js), which is what weapon unlocks are keyed
      // to. Sent only to the attacker; nobody else's unlock progress is their business.
      const totalKills = db.bumpFgKills(ws.fgRoom, attacker.name);
      send(ws, { type: 'fg-unlock-progress', totalKills, unlockedWeapons: fgUnlockedWeapons(totalKills) });
      endFgRound(ws.fgRoom, attackerSlot);
      return;
    }

    if (msg.type === 'fg-leave') {
      leaveFg(ws);
      return;
    }

    if (msg.type === 'fg-leaderboard') {
      // Same missing-flood-gate fix as tv-leaderboard above (found by the leaderboard-integrity audit).
      if (isWsMsgRateLimited(ws)) return;
      const code = String(msg.code || '').toUpperCase().trim();
      if (!code) return;
      send(ws, { type: 'fg-leaderboard-result', scores: db.getLeaderboard(code, 'fg', 10) });
      return;
    }

    if (msg.type === 'bb-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      // No per-chat-room concept in Block Battle's client (it's a standalone page, not launched
      // from inside a specific room) — everyone defaults into one shared global lobby unless a
      // future client explicitly asks for a different one, same room-code plumbing every other
      // minigame already uses either way.
      const code = String(msg.code || 'GLOBAL-LOBBY').toUpperCase().trim() || 'GLOBAL-LOBBY';
      if (ws.bbRoom === code) return;
      if (ws.bbRoom) leaveBb(ws);
      const room = getOrCreateRoom(code);
      // currentMapId defaults to 'office' — there's no lobby-wide vote anymore (see the map-voting
      // comment above); the shared space just starts on the office and only ever changes when a
      // 1v1/2v2/3v3/4v4's own pre-match vote resolves (finalizeBbDuelVote/finalizeBbMatchVote).
      if (!room.bb) room.bb = { players: new Map(), stations: bbInitStations(), matches: new Map(), duels: new Map(), currentMapId: 'office' };
      const bb = room.bb;
      if (bb.players.size >= MAX_GAME_PLAYERS) { send(ws, { type: 'bb-full' }); return; }
      // Real Valk account only — no free-text name field here (unlike bc/fg/etc's `name` param),
      // since the ask was specifically to show the player's actual signed-in username, not
      // whatever they'd type into a box. An anonymous connection just shows as "Guest".
      const account = msg.accountToken ? db.getSessionAccount(String(msg.accountToken)) : null;
      const name = account ? account.username : 'Guest';
      if (db.isBannedFromRoom(code, account ? account.id : null, name)) {
        send(ws, { type: 'bb-join-error', message: "You've been banned from this room" });
        return;
      }
      const level = Math.max(1, Math.min(100000, Math.floor(+msg.level) || 1));
      const skin = BB_SKIN_IDS.includes(String(msg.skin)) ? String(msg.skin) : 'default';
      const id = crypto.randomUUID();
      ws.bbRoom = code;
      ws.bbId = id;
      const entry = {
        id, name, level, skin, x: 0, y: 0, z: 0, yaw: 0, health: BB_MAX_HEALTH, dueling: false, opponentId: null, duelId: null, lastShotAt: 0, respawnedAt: 0,
        plateStation: null, plateSide: null, plateSlot: null, matchId: null, matchSide: null, eliminated: false,
        // Found by the Block Battle client-correctness audit: a second incoming challenge used to
        // silently overwrite the client's popup for the first, with no signal ever sent back to
        // the first challenger — who'd be left waiting forever on a challenge no one can now
        // answer. Tracked so a new challenge can auto-decline whichever one it's replacing.
        pendingChallengeFrom: null,
      };
      bb.players.set(ws, entry);
      const stations = Object.keys(bb.stations).map((sid) => bbStationSnapshot(bb, sid));
      send(ws, { type: 'bb-init', id, players: [...bb.players.values()].filter((p) => p.id !== id), stations, mapId: bb.currentMapId });
      broadcastBb(code, { type: 'bb-player-joined', id, name, level, skin, x: 0, y: 0, z: 0, yaw: 0 }, ws);
      setRoomActivity(code, name, 'bb');
      return;
    }

    // Casts/changes a vote in whichever pre-match map vote the sender is currently part of — a
    // 1v1 duel (duelId) or an NvN station match (matchId), whichever is actually set; a connection
    // can only ever be in one at a time (bbIsBusy already prevents both from being live together).
    if (msg.type === 'bb-vote-match-map' && ws.bbRoom) {
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.bbRoom);
      const bb = room && room.bb;
      const me = bb && bb.players.get(ws);
      if (!me) return;
      const mapId = String(msg.mapId || '');
      if (!BB_MAP_IDS.includes(mapId)) return;
      if (me.duelId) {
        const duel = bb.duels.get(me.duelId);
        if (!duel || duel.phase !== 'voting') return;
        duel.mapVotes.set(ws, mapId);
        const tally = bbMapTally(duel.mapVotes);
        send(duel.aWs, { type: 'bb-match-map-vote-update', tally });
        send(duel.bWs, { type: 'bb-match-map-vote-update', tally });
        return;
      }
      if (me.matchId) {
        const match = bb.matches.get(me.matchId);
        if (!match || match.phase !== 'voting') return;
        match.mapVotes.set(ws, mapId);
        broadcastToBbMatch(bb, me.matchId, { type: 'bb-match-map-vote-update', tally: bbMapTally(match.mapVotes) });
      }
      return;
    }

    if (msg.type === 'bb-leave') {
      leaveBb(ws);
      return;
    }

    if (msg.type === 'bb-pos' && ws.bbRoom) {
      // Same reasoning as bc-pos/sw-pos/gw-pos/fg-pos above — real-time position stream, needs
      // the higher-throughput gate, not the tight chat-message one.
      if (isStrokeRateLimited(ws)) return;
      const room = rooms.get(ws.bbRoom);
      const p = room && room.bb && room.bb.players.get(ws);
      if (!p) return;
      const bbClamp = (n) => Math.max(-BC_MAX_COORD, Math.min(BC_MAX_COORD, +n || 0));
      p.x = bbClamp(msg.x); p.y = bbClamp(msg.y); p.z = bbClamp(msg.z); p.yaw = +msg.yaw || 0;
      broadcastBb(ws.bbRoom, { type: 'bb-pos', id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw }, ws);
      return;
    }

    if (msg.type === 'bb-challenge' && ws.bbRoom) {
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.bbRoom);
      const bb = room && room.bb;
      const me = bb && bb.players.get(ws);
      // A player mid-NvN-match (matchId) or still queued on a plate (plateStation) is already
      // spoken for — without this, accepting a challenge while matchId is still set would leave
      // `dueling` and `matchId` both live at once, and bb-shoot's two branches (gated on matchId
      // vs. dueling separately) would silently apply damage through whichever one fires first,
      // invisible to the other — the exact kind of cross-system state corruption bb-shoot's own
      // matchId-first branch order was never designed to coexist with.
      if (!me || bbIsBusy(me)) return;
      const targetId = String(msg.targetId || '');
      if (targetId === me.id) return; // can't challenge yourself
      const target = bbFindById(bb, targetId);
      // Found by the Block Battle client-correctness audit: a challenge to someone already busy
      // (mid-duel, mid-NvN-match, plate-queued) — or who's already left — used to be dropped here
      // with zero response, while the client shows an unconditional "Challenge sent to X" toast the
      // instant it sends, regardless of whether it actually reached anyone. The challenger had no
      // way to tell a real "waiting on their answer" apart from "this went nowhere." Explicit nack
      // back to the sender lets the client correct its own optimistic toast.
      if (!target) { send(ws, { type: 'bb-challenge-failed', targetId, reason: 'not-found' }); return; }
      if (bbIsBusy(target.p)) { send(ws, { type: 'bb-challenge-failed', targetId, targetName: target.p.name, reason: 'busy' }); return; }
      // Found by the same audit: the target's popup only ever shows the MOST RECENT incoming
      // challenge — a second one used to silently overwrite the first with no signal sent to
      // whoever sent that first one, leaving them waiting forever on a challenge no one could ever
      // now answer. Auto-decline whichever challenge this one is about to replace, same real
      // bb-challenge-declined the target clicking Decline would send.
      if (target.p.pendingChallengeFrom && target.p.pendingChallengeFrom !== me.id) {
        const stale = bbFindById(bb, target.p.pendingChallengeFrom);
        if (stale) send(stale.ws, { type: 'bb-challenge-declined', byId: target.p.id });
      }
      target.p.pendingChallengeFrom = me.id;
      send(target.ws, { type: 'bb-challenged', fromId: me.id, fromName: me.name });
      return;
    }

    if (msg.type === 'bb-challenge-response' && ws.bbRoom) {
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.bbRoom);
      const bb = room && room.bb;
      const me = bb && bb.players.get(ws);
      if (!me || bbIsBusy(me)) return;
      const fromId = String(msg.fromId || '');
      // Guards against responding to a challenge that's already been superseded (see
      // pendingChallengeFrom above) — a stale client-side popup referencing an old fromId that a
      // newer incoming challenge has since auto-declined and replaced.
      if (fromId !== me.pendingChallengeFrom) return;
      me.pendingChallengeFrom = null;
      const from = bbFindById(bb, fromId);
      // The challenger may have left, already started a different duel, or (same reasoning as
      // bb-challenge above) joined an NvN match or plate queue in the time since they sent the
      // challenge — either way there's nothing safe to accept into anymore.
      if (!from || bbIsBusy(from.p)) return;
      if (!msg.accept) { send(from.ws, { type: 'bb-challenge-declined', byId: me.id }); return; }
      // Both sides lock into a mutual duel — this pairing (opponentId matching in both
      // directions) is what bb-shoot below trusts as "these two, and only these two, can hurt
      // each other right now". Mirrors fg-join's own self-target-exploit fix: opponentId is only
      // ever set here, to the OTHER connection's id, never able to end up pointing at yourself.
      // Combat doesn't start yet, though — a short map vote between just these two comes first
      // (see finalizeBbDuelVote); dueling/opponentId are still set immediately so bbIsBusy locks
      // both of them out of a second challenge/plate-queue during that window.
      const duelId = crypto.randomUUID();
      me.dueling = true; me.opponentId = from.p.id; me.duelId = duelId;
      from.p.dueling = true; from.p.opponentId = me.id; from.p.duelId = duelId;
      const voteEndsAt = Date.now() + BB_MATCH_VOTE_MS;
      const duel = { aWs: ws, bWs: from.ws, roundsWonA: 0, roundsWonB: 0, phase: 'voting', mapVotes: new Map(), voteEndsAt, voteTimer: null };
      bb.duels.set(duelId, duel);
      duel.voteTimer = setTimeout(() => finalizeBbDuelVote(ws.bbRoom, duelId), BB_MATCH_VOTE_MS);
      send(ws, { type: 'bb-duel-map-vote', opponentId: from.p.id, opponentName: from.p.name, voteEndsAt, tally: {} });
      send(from.ws, { type: 'bb-duel-map-vote', opponentId: me.id, opponentName: me.name, voteEndsAt, tally: {} });
      return;
    }

    if (msg.type === 'bb-plate-enter' && ws.bbRoom) {
      // Not throttled at bb-pos's per-frame rate — this only fires on an actual plate-to-plate
      // transition (the client tracks that locally), so the ordinary chat-message-rate gate fits.
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.bbRoom);
      const bb = room && room.bb;
      const me = bb && bb.players.get(ws);
      if (!me || me.dueling || me.matchId) return; // already fighting elsewhere — can't also queue
      const stationId = String(msg.stationId || '');
      const station = bb.stations[stationId];
      if (!station) return; // unknown station id — not reachable by the real client, no feedback needed
      const side = msg.side === 'a' || msg.side === 'b' ? msg.side : null;
      const slot = Math.floor(+msg.slot);
      if (!side || !Number.isInteger(slot) || slot < 0 || slot >= station.n) return; // malformed — same as above
      // Both of these ARE reachable by the real client (its plate detection is purely distance-
      // based and doesn't know a station is locked, and two players can physically step onto the
      // same slot in the same instant) — tell the requester explicitly so it can correct its own
      // optimistic bbCurrentPlate immediately, instead of silently believing it holds a slot it
      // doesn't until it happens to physically walk off that spot.
      if (station.matchId || station.queue[side][slot]) {
        send(ws, { type: 'bb-plate-rejected', stationId, side, slot });
        return;
      }
      bbClearPlate(bb, ws.bbRoom, ws); // step off any other plate first
      station.queue[side][slot] = ws;
      me.plateStation = stationId; me.plateSide = side; me.plateSlot = slot;
      broadcastBbStation(ws.bbRoom, stationId);
      bbTryStartMatch(bb, ws.bbRoom, stationId);
      return;
    }

    if (msg.type === 'bb-plate-leave' && ws.bbRoom) {
      const room = rooms.get(ws.bbRoom);
      const bb = room && room.bb;
      if (bb) bbClearPlate(bb, ws.bbRoom, ws);
      return;
    }

    if (msg.type === 'bb-shoot' && ws.bbRoom) {
      const room = rooms.get(ws.bbRoom);
      const bb = room && room.bb;
      const me = bb && bb.players.get(ws);
      if (!me) return;
      if (me.matchId) {
        // NvN match branch — same loose "trust reported position, server gates cooldown/range/
        // alive-state" model as the 1v1 branch below, generalized to pick an explicit target
        // (there's no longer a single implicit opponent once more than one enemy can be in range).
        const myMatch = bb.matches.get(me.matchId);
        if (!myMatch || myMatch.phase !== 'active' || me.eliminated) return; // still mid pre-match map vote, or already dead
        const now = Date.now();
        if (now - me.lastShotAt < BB_WEAPON.cooldownMs) return;
        me.lastShotAt = now;
        const target = bbFindById(bb, String(msg.targetId || ''));
        if (!target || target.ws === ws) return;
        if (target.p.matchId !== me.matchId || target.p.matchSide === me.matchSide || target.p.eliminated) return;
        if (now - target.p.respawnedAt < BB_RESPAWN_GRACE_MS) return;
        const dx = me.x - target.p.x, dy = me.y - target.p.y, dz = me.z - target.p.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) > BB_WEAPON.range) return;
        target.p.health = Math.max(0, target.p.health - BB_WEAPON.damage);
        if (target.p.health > 0) {
          send(target.ws, { type: 'bb-match-hit', health: target.p.health, byId: me.id });
          send(ws, { type: 'bb-match-hit-confirm', targetId: target.p.id, targetHealth: target.p.health });
          // The two messages above only ever reach the shooter and the target — everyone else in
          // the match (teammates on either side) never learns this happened, so their own roster
          // panel keeps showing this player at full health until they suddenly flip to eliminated.
          // This broadcast is redundant for the shooter/target (who already got a more specific
          // message above) but harmless — their client just won't find target.p.id in their own
          // teammates/enemies list (never includes yourself) and no-ops.
          broadcastToBbMatch(bb, me.matchId, { type: 'bb-match-roster-health', id: target.p.id, health: target.p.health });
          return;
        }
        target.p.eliminated = true;
        send(target.ws, { type: 'bb-match-eliminated' });
        broadcastToBbMatch(bb, me.matchId, { type: 'bb-match-player-eliminated', matchId: me.matchId, id: target.p.id });
        bbCheckMatchEnd(bb, ws.bbRoom, me.matchId);
        return;
      }
      if (!me.dueling || !me.opponentId || !me.duelId) return;
      const duel = bb.duels.get(me.duelId);
      if (!duel || duel.phase !== 'active') return; // still mid pre-duel map vote
      const now = Date.now();
      if (now - me.lastShotAt < BB_WEAPON.cooldownMs) return;
      // Consumed right after the cooldown check clears, not only on a landed hit — same fix (and
      // full explanation) as bc-punch/sw-strike/fg-shoot; a shot that misses used to cost
      // nothing, leaving the cooldown trivially bypassable by spamming at an out-of-range target.
      me.lastShotAt = now;
      const target = bbFindById(bb, me.opponentId);
      // Belt-and-suspenders self-target check matching sw-strike/fg-shoot exactly, even though
      // opponentId can't structurally point at yourself (see bb-challenge-response above).
      if (!target || target.ws === ws) return;
      if (!target.p.dueling || target.p.opponentId !== me.id) return; // opponent already left the duel
      if (now - target.p.respawnedAt < BB_RESPAWN_GRACE_MS) return;
      const dx = me.x - target.p.x, dy = me.y - target.p.y, dz = me.z - target.p.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > BB_WEAPON.range) return;
      target.p.health = Math.max(0, target.p.health - BB_WEAPON.damage);
      if (target.p.health > 0) {
        send(target.ws, { type: 'bb-hit', health: target.p.health, byId: me.id });
        // The shooter has no other way to learn their opponent's new health — unlike fg-shoot's
        // shared 2-slot model where both sides already track a scoreboard, an open peer-to-peer
        // lobby's client only knows what the server tells it, so a landed-but-not-lethal hit needs
        // its own explicit reply back to the shooter for the duel HUD's opponent health bar.
        send(ws, { type: 'bb-hit-confirm', opponentHealth: target.p.health });
        return;
      }
      // A knockdown wins the round, not the whole duel — first to BB_ROUNDS_TO_WIN round wins
      // takes the match (see the map-voting comment above for why: a duel now opens with its own
      // pre-fight map vote, so "5 rounds on the map you picked" is worth more than a single kill).
      const iAmA = duel.aWs === ws;
      if (iAmA) duel.roundsWonA += 1; else duel.roundsWonB += 1;
      const myRounds = iAmA ? duel.roundsWonA : duel.roundsWonB;
      const oppRounds = iAmA ? duel.roundsWonB : duel.roundsWonA;
      if (myRounds >= BB_ROUNDS_TO_WIN) {
        const finishedDuelId = me.duelId;
        me.dueling = false; me.opponentId = null; me.duelId = null;
        target.p.dueling = false; target.p.opponentId = null; target.p.duelId = null;
        send(ws, { type: 'bb-duel-won', roundsWon: myRounds, roundsLost: oppRounds });
        send(target.ws, { type: 'bb-duel-lost', roundsWon: oppRounds, roundsLost: myRounds });
        bb.duels.delete(finishedDuelId);
        return;
      }
      me.health = BB_MAX_HEALTH; me.respawnedAt = now;
      target.p.health = BB_MAX_HEALTH; target.p.respawnedAt = now;
      send(ws, { type: 'bb-duel-round-end', won: true, roundsWon: myRounds, roundsLost: oppRounds });
      send(target.ws, { type: 'bb-duel-round-end', won: false, roundsWon: oppRounds, roundsLost: myRounds });
      return;
    }

    if (msg.type === 'tv-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'tv-join-error', message: "You've been banned from this room" });
        return;
      }
      if (ws.tvRoom === code) return; // see bc-join's comment on this same guard
      if (ws.tvRoom) leaveTv(ws);
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
        // alreadyAnswered lets a reconnecting client correctly disable choice buttons instead of
        // blindly re-enabling them for someone who answered this exact question before a brief
        // disconnect — the server-side duplicate-answer guard above is keyed by name for the
        // same reconnect case, so this just keeps the UI honest about it too.
        send(ws, { type: 'tv-question', question: q.q, choices: q.choices, category: q.category, endsAt: tv.roundEndAt, alreadyAnswered: tv.answeredThisRound.has(name) });
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
      // Keyed by name, not the per-connection id — tv-join mints a brand-new random id on every
      // join, including a reconnect mid-round (brief network blip, bouncing to another tab), so
      // keying this by id let a reconnected player answer (and score) the same question twice.
      if (!me || tv.answeredThisRound.has(me.name)) return;
      const q = TV_QUESTIONS[tv.currentQuestion];
      const choice = Math.floor(+msg.choice);
      const correct = choice === q.answerIndex;
      tv.answeredThisRound.set(me.name, correct);
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
      // Found by a minigame-authority audit: every leaderboard-fetch handler in this file (this
      // one and its five siblings — arcade/hm/ch/tt/dg) was missing the isWsMsgRateLimited gate
      // every other state-mutating handler already has — a signed-in-or-not client could hammer
      // unlimited synchronous db.getLeaderboard reads with no cost. Same flood-cost-only shape
      // (no IDOR — the query is already correctly scoped to the caller's own room) as the
      // get-group-dm-threads/get-group-dm-messages fix from an earlier dimension.
      if (isWsMsgRateLimited(ws)) return;
      send(ws, { type: 'tv-leaderboard-result', scores: db.getLeaderboard(ws.tvRoom, 'trivia', 10) });
      return;
    }

    if (msg.type === 'arcade-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      const game = String(msg.game || '');
      if (!code || !ARCADE_LEADERBOARD_KEY[game]) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'arcade-join-error', message: "You've been banned from this room" });
        return;
      }
      // Every other minigame *-join handler guards against a repeat join overwriting its room
      // field with no cleanup of the OLD room's activity entry first (see bc-join's own comment
      // on this same shape) — arcade-join was the one handler missing it (found by a systematic
      // sweep for this bug class). Without this, a second arcade-join for a different room/name
      // left the OLD room's setRoomActivity entry permanently orphaned: neither arcade-leave nor
      // WS-close cleanup can reach it once ws.arcadeRoom/ws.arcadeName point elsewhere. Clearing
      // unconditionally (rather than adding an early-return skip for an identical repeat join,
      // unlike bc-join etc.) keeps every existing response this handler already sends unchanged
      // for the real client, which only ever calls this once per page load anyway.
      if (ws.arcadeRoom && ws.arcadeName) clearRoomActivity(ws.arcadeRoom, ws.arcadeName);
      ws.arcadeRoom = code;
      ws.arcadeGame = game;
      ws.arcadeName = name;
      ws.arcadeJoinedAt = Date.now();
      setRoomActivity(code, name, ARCADE_ACTIVITY_CODE[game]);
      send(ws, { type: 'arcade-leaderboard', scores: db.getLeaderboard(code, ARCADE_LEADERBOARD_KEY[game], 10) });
      return;
    }

    if (msg.type === 'arcade-submit-score' && ws.arcadeRoom) {
      const nowArcade = Date.now();
      if (nowArcade - (ws.arcadeJoinedAt || 0) < ARCADE_SUBMIT_MIN_SESSION_MS) return;
      if (nowArcade - (ws.lastArcadeSubmitAt || 0) < ARCADE_SUBMIT_COOLDOWN_MS) return;
      ws.lastArcadeSubmitAt = nowArcade;
      const score = Math.max(0, Math.min(100000, Math.floor(+msg.score || 0)));
      db.bumpLeaderboard(ws.arcadeRoom, ARCADE_LEADERBOARD_KEY[ws.arcadeGame], ws.arcadeName, score);
      send(ws, { type: 'arcade-leaderboard', scores: db.getLeaderboard(ws.arcadeRoom, ARCADE_LEADERBOARD_KEY[ws.arcadeGame], 10) });
      return;
    }

    if (msg.type === 'arcade-leaderboard' && ws.arcadeRoom) {
      // Same missing-flood-gate fix as tv-leaderboard above.
      if (isWsMsgRateLimited(ws)) return;
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
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'hm-join-error', message: "You've been banned from this room" });
        return;
      }
      if (ws.hmRoom === code) return; // see bc-join's comment on this same guard
      if (ws.hmRoom) leaveHm(ws);
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
      // Same missing-flood-gate fix as tv-leaderboard above.
      if (isWsMsgRateLimited(ws)) return;
      send(ws, { type: 'hm-leaderboard-result', scores: db.getLeaderboard(ws.hmRoom, 'hangman', 10) });
      return;
    }

    if (msg.type === 'hm-leave') {
      leaveHm(ws);
      return;
    }

    if (msg.type === 'ch-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'ch-join-error', message: "You've been banned from this room" });
        return;
      }
      // Same fix as fg-join's — see its comment for the full exploit this closes. Here a repeat
      // join corrupted the game rather than granting a guaranteed win: whiteId/blackId are IDs,
      // not connections, and a second ch-join generates a fresh id and overwrites this ws's single
      // Map entry with it — so the FIRST id (still sitting in whiteId or blackId) permanently
      // points to an entry that no longer exists, soft-locking that color forever (ch-move checks
      // ch.players.get(ws), which only ever reflects the *latest* entry) and, once both colors are
      // "claimed" this way, locking out any real second player too.
      if (ws.chRoom === code) return;
      if (ws.chRoom) leaveCh(ws);
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
      // Found by a minigame-authority audit: an illegal move returns early without flipping
      // ch.turn, so a seated player could resubmit ch-move unboundedly during their own turn —
      // unlike almost every other state-mutating handler in this file, this one had no flood gate.
      // Each attempt runs chessIsLegalMove (a board clone + a full check-safety scan of all 64
      // squares), non-trivial synchronous work on the single-threaded event loop shared by every
      // room on the server, not just the attacker's own game.
      if (isWsMsgRateLimited(ws)) return;
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
      // Same missing-flood-gate fix as tv-leaderboard above.
      if (isWsMsgRateLimited(ws)) return;
      send(ws, { type: 'ch-leaderboard-result', scores: db.getLeaderboard(ws.chRoom, 'chess', 10) });
      return;
    }

    if (msg.type === 'ch-leave') {
      leaveCh(ws);
      return;
    }

    if (msg.type === 'tt-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'tt-join-error', message: "You've been banned from this room" });
        return;
      }
      // Same fix as ch-join's just above (and fg-join's, which this whole class was originally
      // found in) — a repeat join here permanently soft-locks whichever symbol it "claims" a
      // second time, since xId/oId are stable ids but this ws's single Map entry only ever holds
      // the latest one.
      if (ws.ttRoom === code) return;
      if (ws.ttRoom) leaveTt(ws);
      const room = getOrCreateRoom(code);
      if (!room.tt) {
        room.tt = { players: new Map(), mode: 'tictactoe', board: new Array(9).fill(null), turn: 'X', winner: null, winCells: null, xId: null, oId: null };
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
      const meTt = tt && tt.players.get(ws);
      // A spectator (3rd+ joiner, no seat) could otherwise reset the board on a loop and stop
      // the two seated players from ever getting a mode choice that sticks.
      if (!tt || !meTt || !meTt.symbol || !TT_MODES[msg.mode] || tt.board.some((c) => c)) return; // only before the first move
      tt.mode = msg.mode;
      const cfg = TT_MODES[tt.mode];
      tt.board = new Array(cfg.width * cfg.height).fill(null);
      tt.winner = null;
      tt.winCells = null;
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
      // Same missing-flood-gate class as ch-move above — milder here (board math is trivial), but
      // added for consistency with every other state-mutating handler in this file.
      if (isWsMsgRateLimited(ws)) return;
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
      const result = ttCheckWinner(tt.board, cfg.width, cfg.height, cfg.winLength);
      tt.winner = result ? result.symbol : null;
      tt.winCells = result ? result.cells : null;
      if (result && result.symbol !== 'draw') {
        for (const p of tt.players.values()) {
          if (p.symbol === result.symbol) { p.wins += 1; db.bumpLeaderboard(ws.ttRoom, `tictactoe-${tt.mode}`, p.name, p.wins); }
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
      tt.winCells = null;
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
      // Same missing-flood-gate fix as tv-leaderboard above.
      if (isWsMsgRateLimited(ws)) return;
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
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'dg-join-error', message: "You've been banned from this room" });
        return;
      }
      if (ws.dgRoom === code) return; // see bc-join's comment on this same guard
      if (ws.dgRoom) leaveDg(ws);
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
        // guessedThisRound is keyed by name (stable across a reconnect), while `id` above is a
        // fresh per-connection value every dg-join generates — without this, a client reconnecting
        // mid-round (e.g. a brief network blip) has no way to know it already guessed correctly
        // this round, the same class of gap trivia's alreadyAnswered already closes for tv-question.
        alreadyGuessed: dg.guessedThisRound.has(name),
      });
      broadcastDg(code, { type: 'dg-player-joined', id, name, isSpectator }, ws);
      setRoomActivity(code, name, 'dg');
      return;
    }

    if (msg.type === 'dg-set-spectator' && ws.dgRoom) {
      // No natural bounding the way dg-start/dg-set-category have (can't restart/re-category an
      // active round) — this can be toggled at will, any time, with a room-wide broadcast every
      // call.
      if (isWsMsgRateLimited(ws)) return;
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
      // Only bounded to "no active round" — freely spammable the whole time a room sits between
      // rounds (which could be indefinitely, e.g. everyone just chatting), each call broadcasting
      // to the room.
      if (isWsMsgRateLimited(ws)) return;
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
      if (isStrokeRateLimited(ws)) return;
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
      // Drawer-only, but unbounded during their own turn — same shape as wb-clear's existing gate.
      if (isWsMsgRateLimited(ws)) return;
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
      // Same flood gate every other chat-creation path in this app shares — unlike its sibling
      // dg-stroke (rate-limited just above), guesses/post-guess chat had no throttle at all.
      if (isWsMsgRateLimited(ws)) return;
      const text = String(msg.text || '').slice(0, 100).trim();
      if (!text) return;
      // Mute only silences the free-text chat broadcast below (same as real room chat), not the
      // guessing mechanic itself — a muted player can still submit a correct guess and score.
      const dgMuted = !!(room.muted && room.muted.has(me.name));
      if (dg.guessedThisRound.has(me.name)) {
        // A player who's already guessed correctly can still chat, but not by typing the literal
        // answer again — this used to broadcast their text unfiltered, letting the secret word
        // leak straight into the guess-chat feed for everyone still trying to guess it.
        if (text.toLowerCase() === String(dg.word || '').toLowerCase()) return;
        if (!dgMuted) broadcastDg(ws.dgRoom, { type: 'dg-guess-chat', name: me.name, text });
        return;
      }
      if (text.toLowerCase() === String(dg.word || '').toLowerCase()) {
        dg.guessedThisRound.add(me.name);
        const points = dg.guessedThisRound.size === 1 ? 3 : 1;
        me.score += points;
        db.bumpLeaderboard(ws.dgRoom, 'pictionary', me.name, me.score);
        broadcastDg(ws.dgRoom, { type: 'dg-correct', id: me.id, name: me.name, points, score: me.score });
        const guessableCount = [...dg.players.values()].filter((p) => !p.isSpectator).length - 1;
        if (guessableCount > 0 && dg.guessedThisRound.size >= guessableCount) endDgRound(ws.dgRoom);
      } else if (!dgMuted) {
        broadcastDg(ws.dgRoom, { type: 'dg-guess-chat', name: me.name, text });
      }
      return;
    }

    if (msg.type === 'dg-leave') {
      leaveDg(ws);
      return;
    }

    if (msg.type === 'dg-leaderboard' && ws.dgRoom) {
      // Same missing-flood-gate fix as tv-leaderboard above.
      if (isWsMsgRateLimited(ws)) return;
      send(ws, { type: 'dg-leaderboard-result', scores: db.getLeaderboard(ws.dgRoom, 'pictionary', 10) });
      return;
    }

    if (msg.type === 'wb-join') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      const name = String(msg.name || 'Player').slice(0, 30).trim() || 'Player';
      if (!code) return;
      if (db.isBannedFromRoom(code, ws.accountId || null, name)) {
        send(ws, { type: 'wb-join-error', message: "You've been banned from this room" });
        return;
      }
      if (ws.wbRoom === code) return; // see bc-join's comment on this same guard
      if (ws.wbRoom) leaveWb(ws);
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
      if (isStrokeRateLimited(ws)) return;
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
      // Unlike wb-stroke just above (rate-limited via isStrokeRateLimited, a generous per-stroke
      // gate for legitimate drawing), this one had no gate at all — despite being the more
      // impactful action: any participant (no drawer/host check either, unlike dg-clear's
      // drawer-only gate) could wipe the whole room's whiteboard, a real DB write plus a broadcast
      // to everyone, as fast as the network allows. The standard content-creation gate fits its
      // "destructive room-wide action" weight better than the high-frequency stroke one.
      if (isWsMsgRateLimited(ws)) return;
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
      // Same flood gate every other message-creation path shares (see 'message'/'send-dm'/
      // 'send-group-dm'/'scorpture-live-chat') — this one fires a real push notification per
      // call, so an unthrottled loop is both spam and a push-bombing vector against a friend.
      if (isWsMsgRateLimited(ws)) {
        send(ws, { type: 'error', message: 'You are sending messages too fast — slow down a bit.' });
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
      // Same flood gate as every other message/content-creation path in this app — this is a DB
      // write plus a live WS fanout (and a toast on every other member's open tab) to everyone
      // added, and had no throttle of its own even though its sibling send-group-dm already does.
      if (isWsMsgRateLimited(ws)) {
        send(ws, { type: 'error', message: 'You are creating group DMs too fast — slow down a bit.' });
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
      // Found by a friends/DM authorization audit: every other group-DM handler (create/send/leave)
      // already gates on isWsMsgRateLimited; these two read-only handlers were left out, letting a
      // signed-in client hammer unlimited DB reads (member-list + last-message subqueries per
      // thread) with no cost. Scoping to the caller's own membership was already correct — this is
      // purely a flood-cost gap, not an IDOR.
      if (isWsMsgRateLimited(ws)) return;
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in to view group DMs' });
        return;
      }
      send(ws, { type: 'group-dm-threads', threads: db.getGroupDmsForAccount(ws.accountId) });
      return;
    }

    if (msg.type === 'get-group-dm-messages') {
      if (isWsMsgRateLimited(ws)) return;
      if (!ws.accountId) {
        send(ws, { type: 'error', message: 'Sign in to view group DMs' });
        return;
      }
      const groupId = String(msg.groupId || '');
      if (!db.isGroupDmMember(groupId, ws.accountId)) {
        send(ws, { type: 'error', message: 'Not a member of that group DM' });
        return;
      }
      // Same block filter as live delivery in sendGroupDm — without it, reopening/reloading the
      // thread would show every message a blocked member ever sent even though none of them were
      // delivered live, which is worse than doing nothing (the block would look broken, not just
      // incomplete). getBlockedAccountIds fetches both-directions-blocked-with-me once instead of
      // an isBlockedBetween query per message (up to 200, the default history limit).
      const blockedIds = db.getBlockedAccountIds(ws.accountId);
      const messages = db.getGroupDmMessages(groupId).filter((m) => !blockedIds.has(m.fromAccountId));
      send(ws, { type: 'group-dm-messages', groupId, messages });
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
      if (isWsMsgRateLimited(ws)) {
        send(ws, { type: 'error', message: 'You are sending messages too fast — slow down a bit.' });
        return;
      }
      const now = Date.now();
      const entry = { id: crypto.randomUUID(), groupId, fromAccountId: ws.accountId, fromName: ws.profile.name, text, at: now };
      db.insertGroupDmMessage(entry);
      sendGroupDm(groupId, ws.accountId, ws.profile.name, text, ws);
      send(ws, { type: 'group-dm-sent', message: entry });
      return;
    }

    if (msg.type === 'leave-group-dm') {
      // Added when this got real client UI a few commits ago — until then the handler was
      // unreachable so a missing gate didn't matter. A repeat/garbage groupId still costs a
      // db.isGroupDmMember read on every call even though it's rejected, and unlike bc-claim
      // (whose repeated-attempt case is a genuinely free no-op) that's not zero-cost.
      if (isWsMsgRateLimited(ws)) return;
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
      // Found by a functional-correctness audit: only the socket that issued the leave got
      // 'group-dm-left'. A second open tab/device on the same account (thread left open there
      // too) never heard about it — its overlay stayed open showing a thread it's no longer a
      // member of, and the next send-group-dm from that tab would silently fail server-side with
      // no explanation shown. Fan this out to every live connection of the leaving account, same
      // as the remaining-members loop below does for them.
      const ownConnections = accountConnections.get(ws.accountId);
      if (ownConnections) {
        for (const c of ownConnections) {
          if (c.readyState === c.OPEN) send(c, { type: 'group-dm-left', groupId });
        }
      } else {
        send(ws, { type: 'group-dm-left', groupId });
      }
      // The remaining members previously got no live signal at all when someone left — their
      // rendered member list for this thread stayed stale (still showing the departed user)
      // until they next reopened the thread. Message delivery itself was unaffected (member set
      // is re-queried at send time), this only fixes the display.
      const leftPayload = JSON.stringify({ type: 'group-dm-member-left', groupId, username: ws.profile.name });
      for (const accountId of db.getGroupDmMemberIds(groupId)) {
        const liveConnections = accountConnections.get(accountId);
        if (!liveConnections) continue;
        for (const c of liveConnections) {
          if (c.readyState === c.OPEN) c.send(leftPayload);
        }
      }
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
      // Without this, a connection already in another room that sends create-room instead of
      // leave-room first overwrites ws.room with no cleanup of the OLD room at all — same "second
      // join, no leave" bug class bc-join/gw-join/etc. all guard against, just never applied here.
      // The old room's room.clients entry and (worse) its room.voice entry, if this connection had
      // an open voice call, both stay resident and reachable forever: a real disconnect later only
      // ever cleans up whatever room ws.room *currently* points to, permanently orphaning the old
      // one as a live, silently-still-participating voice-signaling target nobody else can see.
      if (ws.room) leaveRoom(ws);
      const code = generateRoomCode();
      db.upsertRoom(code);
      db.setRoomHostIfUnset(code, ws.profile.name, ws.accountId || null);
      rooms.set(code, { history: [], clients: new Set([ws]) });
      ws.room = code;
      send(ws, { type: 'joined-room', code, messages: [], users: roomUsers(code), name: null, reactions: [], pins: [], activity: [], isHost: true, announcement: null, wallpaperUrl: null, pinRequired: false });
      return;
    }

    if (msg.type === 'join-room') {
      if (isWsMsgRateLimited(ws)) return; // see bc-join's comment on this same guard
      const code = String(msg.code || '').toUpperCase().trim();
      // One fetch, reused below — this used to call db.getRoom(code) three separate times for
      // the same code within one handler (existence check, this assignment, and again just to
      // read host_name near the end). Each is a cheap PK point-lookup so the cost was never high,
      // but there's no reason not to reuse a value already in hand.
      const dbRoom = db.getRoom(code);
      if (!rooms.has(code) && !dbRoom) {
        send(ws, { type: 'join-error', message: 'Room not found' });
        return;
      }
      if (db.isBannedFromRoom(code, ws.accountId || null, ws.profile.name)) {
        send(ws, { type: 'join-error', message: "You've been banned from this room" });
        return;
      }
      // A lightweight join gate, not real security (no accounts here to hash a PIN against) —
      // just enough to keep a room from being joined by anyone who guesses/finds the 5-char code.
      if (dbRoom && dbRoom.pin_required) {
        const suppliedPin = String(msg.pin || '').trim();
        if (!roomPinOk(dbRoom, suppliedPin)) {
          send(ws, { type: 'join-error', message: suppliedPin ? 'Incorrect PIN' : 'This room requires a PIN', pinRequired: true });
          return;
        }
      }
      // Same fix as create-room's just above — a connection switching rooms via join-room without
      // ever sending leave-room first left the OLD room's client/voice entries permanently
      // orphaned. Skipped when it's the same room (a real client re-requesting full state, e.g.
      // after navigating to a minigame and back — that's an intentional, harmless no-op re-join).
      if (ws.room && ws.room !== code) leaveRoom(ws);
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
      // hostName/hostAccountId track whichever values are now actually true in the DB, since
      // setRoomHostIfUnset below can change them out from under the stale `dbRoom` object fetched
      // above — this avoids a third db.getRoom(code) purely to re-read the fields it itself just
      // wrote.
      let hostName = dbRoom ? dbRoom.host_name : null;
      let hostAccountId = dbRoom ? dbRoom.host_account_id : null;
      if (dbRoom && !dbRoom.host_name) {
        db.setRoomHostIfUnset(code, ws.profile.name, ws.accountId || null);
        hostName = ws.profile.name;
        hostAccountId = ws.accountId || null;
      }
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
        reactions: db.getReactionsForRoom(code, HISTORY_LIMIT),
        pins: db.getPins(code),
        // read_receipts was being faithfully written on every 'read' message (correct identity,
        // correct room-scoping, rate-limited) but never read back — found by a read-receipt-
        // integrity audit. A client joining/reconnecting saw no "seen by" info until each other
        // member's next natural read event re-fired it. Mirrors how reactions/pins are already
        // hydrated on join, just for this one field that was missed.
        readReceipts: db.getReadReceipts(code),
        activity: roomActivityList(room),
        isHost: isRoomHost({ host_name: hostName, host_account_id: hostAccountId }, ws),
        announcement: dbRoom ? dbRoom.announcement : null,
        wallpaperUrl: dbRoom ? dbRoom.wallpaper_url : null,
        // Found by the room-settings/menu-panel correctness audit: the host-only PIN form gave no
        // indication whether a PIN was currently even set — always the same blank field/placeholder
        // regardless of actual state, only discoverable by trying to (re)join blind. Never sends
        // the PIN itself, just whether one is required, same boolean roomPinOk already checks.
        pinRequired: !!(dbRoom && dbRoom.pin_required),
        voiceCallActive: !!(room.voice && room.voice.size > 0),
      });
      broadcastRoom(code, { type: 'system', text: `${ws.profile.name} joined the room`, at: Date.now() }, ws);
      broadcastRoom(code, { type: 'presence', users: roomUsers(code) });
      return;
    }

    if (msg.type === 'set-avatar') {
      // Every other "attach media" path in this app (post-image, post-media, scorpture uploads/
      // banner/avatar) requires a real /uploads/ URL — this one didn't, letting a raw WS client
      // (bypassing the real UI, which only ever sends back its own /upload result — see app.js's
      // set-avatar send site) set any external URL as their avatar. It's rendered as a real <img
      // src> for every room member who sees that user (makeAvatar in app.js), so an arbitrary URL
      // here is a tracking-pixel vector: everyone who loads the room fetches attacker.com and
      // leaks their IP, independent of whether they ever open a message from that user.
      // Same flood gate every other content-mutating path in this app shares — this and its two
      // siblings below (set-status, set-name) had none, despite each doing a DB write plus a
      // room-wide broadcast on every single call.
      if (isWsMsgRateLimited(ws)) return;
      const rawAvatarUrl = typeof msg.avatarUrl === 'string' ? msg.avatarUrl.slice(0, 500) : null;
      const avatarUrl = rawAvatarUrl && rawAvatarUrl.startsWith('/uploads/') ? rawAvatarUrl : null;
      claimUpload(avatarUrl);
      // Found by a file-upload storage audit: replacing an avatar never deleted the file it
      // superseded, same unbounded-disk-fill shape fixed at the Scorpture banner/avatar/thumbnail
      // routes above (re-set an avatar near the 300MB cap indefinitely, no cleanup). profiles is
      // keyed by display name, not an authenticated account, so ws.profile.avatarUrl (this
      // connection's own live view, captured before it's overwritten below) is the only "old value"
      // available here — same last-write-wins model this route's profile row already accepts for
      // name/status.
      const oldAvatarUrl = ws.profile.avatarUrl;
      ws.profile.avatarUrl = avatarUrl;
      db.upsertProfile(ws.profile.name, { avatarUrl });
      if (avatarUrl !== oldAvatarUrl) deleteUploadFile(oldAvatarUrl);
      const payload = { type: 'profile-updated', name: ws.profile.name, avatarUrl, status: ws.profile.status };
      send(ws, payload);
      if (ws.room) broadcastRoom(ws.room, payload, ws);
      return;
    }

    if (msg.type === 'set-status') {
      if (isWsMsgRateLimited(ws)) return;
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
      // Placed after the no-op "same name" short-circuit above (nothing to throttle there — no
      // write, no broadcast) but before the duplicate-name scan and the actual rename, so a
      // rate-limited request doesn't pay for either.
      if (isWsMsgRateLimited(ws)) return;
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
      // Found by a room-host/moderation-powers audit: for a signed-in host, renameRoomHostIfMatches'
      // accountId branch updates every room that account hosts (not just ws.room), so this call must
      // run even when the renaming connection isn't currently sitting in any room at all — nesting
      // it inside `if (ws.room)` (as it used to be) silently skipped updating host_name for every
      // OTHER room that account hosts, leaving those rooms pointing at a stale display name (locking
      // the real host out of a room they created just by renaming while elsewhere, and leaving that
      // room's host slot squattable by name in the meantime). A guest (no accountId) has no identity
      // to key off outside ws.room anyway, so passing `ws.room || null` is a safe no-op for them when
      // they have no current room.
      db.renameRoomHostIfMatches(ws.room || null, oldName, newName, ws.accountId || null);
      if (ws.room) {
        const room = rooms.get(ws.room);
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
      // Host-only, but the flood cost lands on every room on the server (synchronous DB write
      // blocks the shared event loop), not just the attacker's own — same reasoning as
      // resolveModerationTarget's identical guard just above.
      if (isWsMsgRateLimited(ws)) return;
      const dbRoom = db.getRoom(ws.room);
      if (!isRoomHost(dbRoom, ws)) return;
      const name = String(msg.name || '').slice(0, 50).trim() || null;
      db.upsertRoom(ws.room, name);
      broadcastRoom(ws.room, { type: 'room-renamed', name });
      return;
    }

    if (msg.type === 'set-room-pin' && ws.room) {
      if (isWsMsgRateLimited(ws)) return; // see rename-room's comment on this same guard
      const dbRoom = db.getRoom(ws.room);
      if (!isRoomHost(dbRoom, ws)) return;
      const pin = String(msg.pin || '').slice(0, 12).trim() || null;
      db.setRoomPin(ws.room, pin);
      send(ws, { type: 'room-pin-updated', pinRequired: !!pin });
      return;
    }

    if (msg.type === 'set-wallpaper' && ws.room) {
      if (isWsMsgRateLimited(ws)) return; // see rename-room's comment on this same guard
      const dbRoom = db.getRoom(ws.room);
      if (!isRoomHost(dbRoom, ws)) return;
      // Same tracker-link gap set-avatar had (fixed earlier this session): the real UI only ever
      // sends back its own /upload result, but nothing server-side enforced that — a raw WS client
      // could set any external URL, loaded as a real background-image for every room member.
      const rawUrl = typeof msg.url === 'string' ? msg.url.slice(0, 500) : null;
      const url = rawUrl && rawUrl.startsWith('/uploads/') ? rawUrl : null;
      claimUpload(url);
      db.setWallpaper(ws.room, url);
      broadcastRoom(ws.room, { type: 'wallpaper-updated', url });
      return;
    }

    if (msg.type === 'set-announcement' && ws.room) {
      if (isWsMsgRateLimited(ws)) return; // see rename-room's comment on this same guard
      const dbRoom = db.getRoom(ws.room);
      if (!isRoomHost(dbRoom, ws)) return;
      const text = String(msg.text || '').slice(0, 200).trim() || null;
      db.setAnnouncement(ws.room, text);
      broadcastRoom(ws.room, { type: 'announcement-updated', text });
      return;
    }

    // ---- Moderation: whoever created the room (host_name, set once at creation) can kick/mute.
    // Weak by design, same trust model as everything else here (no accounts to actually verify
    // identity) — this stops accidental/casual disruption, not a determined impersonator. ----
    if (msg.type === 'kick-user' && ws.room) {
      const modTarget = resolveModerationTarget(ws, msg);
      if (!modTarget) return;
      const { room, targetName } = modTarget;
      let targetAccountId = (room.recentAccountsByName && room.recentAccountsByName.get(targetName)) || null;
      for (const client of [...room.clients]) {
        if (client.profile && client.profile.name === targetName) {
          if (client.accountId) targetAccountId = client.accountId;
          send(client, { type: 'kicked', by: ws.profile.name });
          leaveRoom(client);
        }
      }
      evictAccountFromRoomSessions(targetAccountId, ws.room);
      return;
    }

    if (msg.type === 'mute-user' && ws.room) {
      const modTarget = resolveModerationTarget(ws, msg);
      if (!modTarget) return;
      const { room, targetName } = modTarget;
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
      // Without this, the host's own mute button never flipped to "unmute" until some unrelated
      // event (someone else joining/leaving) happened to trigger the next presence refresh —
      // roomUsers()'s new `muted` field is otherwise correct but stale until then.
      broadcastRoom(ws.room, { type: 'presence', users: roomUsers(ws.room) });
      return;
    }

    if (msg.type === 'unmute-user' && ws.room) {
      if (isWsMsgRateLimited(ws)) return; // see rename-room's comment on this same guard
      const dbRoom = db.getRoom(ws.room);
      if (!isRoomHost(dbRoom, ws)) return;
      const targetName = String(msg.name || '').trim();
      const room = rooms.get(ws.room);
      if (room && room.muted) room.muted.delete(targetName);
      const targetClient = room && [...room.clients].find((c) => c.profile && c.profile.name === targetName);
      const targetAccountId = targetClient && targetClient.accountId
        ? targetClient.accountId
        : (db.getPersistentMuteByName(ws.room, targetName) || {}).target_account_id;
      if (targetAccountId) db.removePersistentMute(ws.room, targetAccountId);
      broadcastRoom(ws.room, { type: 'user-unmuted', name: targetName });
      broadcastRoom(ws.room, { type: 'presence', users: roomUsers(ws.room) });
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
      const modTarget = resolveModerationTarget(ws, msg);
      if (!modTarget) return;
      const { room, targetName } = modTarget;
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
      evictAccountFromRoomSessions(targetAccountId, ws.room);
      broadcastRoom(ws.room, { type: 'user-banned', name: targetName });
      return;
    }

    if (msg.type === 'unban-user' && ws.room) {
      if (isWsMsgRateLimited(ws)) return; // see rename-room's comment on this same guard
      const dbRoom = db.getRoom(ws.room);
      if (!isRoomHost(dbRoom, ws)) return;
      const banId = String(msg.banId || '');
      if (!banId) return;
      db.unbanFromRoom(banId, ws.room);
      send(ws, { type: 'bans-result', bans: db.getRoomBans(ws.room) });
      return;
    }

    if (msg.type === 'get-bans' && ws.room) {
      const dbRoom = db.getRoom(ws.room);
      if (!isRoomHost(dbRoom, ws)) return;
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
      // Same flood gate as its sibling content-mutating paths — re-voting rapidly on the same
      // poll (changing your own vote back and forth) broadcasts the full vote tally to the whole
      // room on every call, with no throttle before this.
      if (isWsMsgRateLimited(ws)) return;
      const messageId = String(msg.messageId || '');
      const target = db.getMessage(messageId);
      if (!target || target.room_code !== ws.room || target.media_type !== 'poll' || target.deleted) return;
      let options;
      try { options = JSON.parse(target.text).options; } catch { return; }
      const optionIndex = Math.floor(+msg.optionIndex);
      // Number.isInteger rejects NaN explicitly — without it, a non-numeric optionIndex (e.g. an
      // object/array/string) makes both bounds comparisons below false (NaN comparisons always
      // are), so the check never trips and NaN gets bound straight into the DB, where better-
      // sqlite3 silently stores it as SQL NULL instead of throwing — a corrupted-looking vote
      // broadcast to the whole room for an option that was never actually selected.
      if (!Array.isArray(options) || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) return;
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
      // Same shape scorpture-watch-live is gated for: a repeated join loop without an intervening
      // voice-leave re-fires voice-peer-joined at every existing peer each time, forcing every
      // participant's browser to spin up a fresh RTCPeerConnection.
      if (isWsMsgRateLimited(ws)) return;
      // A prior voice-join under an old ws.profile.sub (e.g. join-server firing again mid-call,
      // see leaveVoice's own comment) must be purged before adding a new entry — otherwise this
      // same connection ends up with two live entries in room.voice, one of them forever orphaned
      // (found by a systematic sweep for this session's "reassigned identity field" bug class).
      // Called before voiceRoom() creates/fetches the Map so a resulting empty-room teardown
      // (leaveVoice deletes room.voice when it empties) doesn't race with a stale local reference.
      leaveVoice(ws);
      const code = ws.room;
      const voice = voiceRoom(code, true);
      const sub = ws.profile.sub;
      const name = ws.profile.name;
      const wasEmpty = voice.size === 0;
      // Found by the voice-call client-side audit: a hand raised before someone joins (or
      // rejoins after a network blip) used to be invisible to them forever — voice-peers only
      // ever carried sub/name, so a late joiner's tile started (and stayed) un-raised until the
      // raiser happened to lower and re-raise it. raised now travels with the rest of a peer's
      // live call state on this same snapshot.
      const existing = [...voice.entries()]
        .filter(([s]) => s !== sub)
        .map(([s, p]) => ({ sub: s, name: p.name, raised: !!p.raised }));
      voice.set(sub, { ws, name, raised: false });
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
      // The sender being in the room's chat isn't the same as being on the call — without this
      // check, anyone in the text room (never having sent voice-join) could forge a signal to a
      // real participant's sub, making the victim's client create a fresh RTCPeerConnection + a
      // ghost call tile for a "peer" that never actually joined. That ghost never gets cleaned up
      // by the normal voice-peer-left path (the forger was never in the `voice` Map to begin with).
      if (!voice || !voice.has(ws.profile.sub)) return;
      // The bc-pos/whiteboard-stroke gate, not the tight chat one — real ICE-candidate exchange
      // during connection setup (especially with several peers already on the call) legitimately
      // bursts well past the chat gate's ~1.3/sec, and this is only reachable by an already-
      // verified call participant (the voice.has check above), not an arbitrary client.
      if (isStrokeRateLimited(ws)) return;
      const target = voice.get(String(msg.to || ''));
      if (!target) return;
      send(target.ws, { type: 'voice-signal', from: ws.profile.sub, signal: msg.signal });
      return;
    }

    if (msg.type === 'voice-share' && ws.room) {
      const voice = voiceRoom(ws.room, false);
      const sub = ws.profile.sub;
      if (!voice || !voice.has(sub)) return;
      if (isWsMsgRateLimited(ws)) return;
      for (const [s, p] of voice) {
        if (s !== sub) send(p.ws, { type: 'voice-share', sub, sharing: !!msg.sharing });
      }
      return;
    }

    if ((msg.type === 'raise-hand' || msg.type === 'lower-hand') && ws.room) {
      const voice = voiceRoom(ws.room, false);
      const sub = ws.profile.sub;
      if (!voice || !voice.has(sub)) return;
      if (isWsMsgRateLimited(ws)) return;
      const raised = msg.type === 'raise-hand';
      voice.get(sub).raised = raised;
      for (const [s, p] of voice) {
        if (s !== sub) send(p.ws, { type: raised ? 'hand-raised' : 'hand-lowered', sub, name: ws.profile.name });
      }
      return;
    }

    // A request, not an enforced mute — this app has no roles/auth, so nothing should ever
    // let one participant force-mute another's mic. Every peer decides for itself. Still requires
    // the sender to actually be on the call — otherwise anyone in the text room (never having
    // joined the call) could force-mute every real participant with no way to tell it wasn't a
    // genuine fellow caller.
    if (msg.type === 'mute-all-request' && ws.room) {
      const voice = voiceRoom(ws.room, false);
      const sub = ws.profile.sub;
      if (!voice || !voice.has(sub)) return;
      if (isWsMsgRateLimited(ws)) return;
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
      // A muted user was still able to send full free-text private DMs — a real harassment
      // bypass, arguably worse than the equivalent edit-message gap fixed above, since this is an
      // entirely fresh, unrestricted channel rather than editing something already said.
      if (room.muted && room.muted.has(ws.profile.name)) {
        send(ws, { type: 'error', message: 'You have been muted in this room' });
        return;
      }
      const targetClient = [...room.clients].find((c) => c.profile && c.profile.name === toName);
      if (!targetClient) {
        send(ws, { type: 'error', message: `${toName} is not currently in this room` });
        return;
      }
      // Shares the same flood gate as regular chat messages so DMs can't be used to dodge it.
      if (isWsMsgRateLimited(ws)) {
        send(ws, { type: 'error', message: 'You are sending messages too fast — slow down a bit.' });
        return;
      }
      const now = Date.now();
      // Recorded alongside the name pair (see getDmThread's comment on insertMessage's
      // account_id) so a signed-in participant's side of the thread stays theirs even if someone
      // else later reconnects under the same now-vacated display name.
      const entry = {
        id: crypto.randomUUID(), roomCode: ws.room, fromName: ws.profile.name, toName, text, at: now,
        fromAccountId: ws.accountId || null,
        toAccountId: targetClient.accountId || null,
      };
      db.insertDm(entry);
      const payload = { type: 'dm', id: entry.id, fromName: entry.fromName, toName: entry.toName, text: entry.text, at: entry.at };
      send(ws, payload);
      send(targetClient, payload);
      return;
    }

    if (msg.type === 'get-dm-thread' && ws.room) {
      const withName = String(msg.withName || '').trim();
      if (!withName) return;
      send(ws, { type: 'dm-thread', withName, messages: db.getDmThread(ws.room, ws.profile.name, withName, ws.accountId || null) });
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
      if (isWsMsgRateLimited(ws)) {
        send(ws, { type: 'error', message: 'You are sending messages too fast — slow down a bit.' });
        return;
      }
      const text = String(msg.text || '').slice(0, 2000).trim();
      const mediaType = ['video', 'image', 'audio', 'poll'].includes(msg.mediaType) ? msg.mediaType : null;
      // Every other "attach media" path in this app (post-image, post-media, scorpture uploads)
      // requires a real /uploads/ URL — this was the one place that didn't, letting any user post
      // an arbitrary external URL that auto-loads (mediaType 'video'/'image'/'audio') in every
      // room member's browser as a classic IP/UA-grabbing tracker link. Polls use the literal
      // sentinel 'poll' here instead of a real URL, so they're exempted from the prefix check.
      // Found by the sticker-picker audit: the curated sticker pack (public/stickers.js) posts a
      // static /images/stickers/<file> URL, not an /uploads/ one — this check rejected every
      // single one, so every sticker send was silently dropped right here with zero error back to
      // the sender. STICKER_URLS (built from the real files on disk, see above) is the same kind
      // of known-safe exception the AI Studio pollinations.ai host gets in /post-image, just for a
      // fixed local file set instead of a fixed external host.
      const mediaUrl = typeof msg.mediaUrl === 'string' && (mediaType === 'poll' ? msg.mediaUrl === 'poll' : (msg.mediaUrl.startsWith('/uploads/') || STICKER_URLS.has(msg.mediaUrl)))
        ? msg.mediaUrl
        : null;
      if (!text && !(mediaUrl && mediaType)) return;
      if (mediaType === 'poll' && !isValidPollText(text)) return;
      // Claimed only after both rejections above — a raw WS client sending a real /uploads/
      // mediaUrl alongside an empty text and an invalid/missing mediaType used to get this file
      // claimed here and then the whole message silently dropped by the very next line, leaving a
      // genuinely-uploaded file marked "claimed" (exempt from the orphan sweep) forever despite
      // never actually being attached to any message. Same ordering fix as /post-image and the
      // Scorpture overlays route elsewhere in this file.
      claimUpload(mediaUrl);

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
      db.insertMessage({ id: entry.id, roomCode: ws.room, name: entry.name, text: entry.text, mediaUrl: entry.mediaUrl, mediaType: entry.mediaType, replyToId, at: entry.at, accountId: ws.accountId || null });
      db.upsertRoom(ws.room);
      broadcastRoom(ws.room, entry);
      pushNewMessage(ws.room, entry);
      pushMentionNotifications(ws.room, entry, ws.accountId || null);
      return;
    }

    if (msg.type === 'edit-message' && ws.room) {
      // Same flood gate as 'message' above — bounded to editing your own messages, but repeatedly
      // re-editing one still broadcasts to the whole room on every call with no throttle before
      // this.
      if (isWsMsgRateLimited(ws)) return;
      const room = rooms.get(ws.room);
      // The 'message' handler above refuses a muted user's *new* posts, but this never checked
      // the same thing — a muted user could still edit an existing message of theirs to say
      // anything, a real moderation bypass (mute someone, and they just repurpose whatever they
      // already had posted instead of being blocked outright).
      if (room && room.muted && room.muted.has(ws.profile.name)) {
        send(ws, { type: 'error', message: 'You have been muted in this room' });
        return;
      }
      const messageId = String(msg.messageId || '');
      const text = String(msg.text || '').slice(0, 2000).trim();
      if (!messageId || !text) return;
      const target = db.getMessage(messageId);
      // Polls store structured JSON in `text` (see isValidPollText) — editing was never a
      // supported poll feature and this generic free-text path has no shape validation, so
      // allowing it here would let a user corrupt their own poll the same way the message
      // handler above now guards against on creation.
      if (!target || target.room_code !== ws.room || !ownsMessage(target, ws) || target.deleted || target.media_type === 'poll') return;
      db.updateMessageText(messageId, text);
      const entry = room && room.history.find((m) => m.id === messageId);
      if (entry) { entry.text = text; entry.edited = true; }
      broadcastRoom(ws.room, { type: 'message-edited', messageId, text });
      return;
    }

    if (msg.type === 'delete-message' && ws.room) {
      // Same flood gate as 'edit-message' above — each individual message can only be deleted
      // once (target.deleted guards that), but rapidly deleting many different messages in a row
      // still broadcasts to the whole room every time, with no throttle before this.
      if (isWsMsgRateLimited(ws)) return;
      const messageId = String(msg.messageId || '');
      if (!messageId) return;
      const target = db.getMessage(messageId);
      if (!target || target.room_code !== ws.room || target.deleted) return;
      const dbRoom = db.getRoom(ws.room);
      const isHost = isRoomHost(dbRoom, ws);
      if (!ownsMessage(target, ws) && !isHost) return;
      // Found by a file-upload storage audit: deleteMessageRow nulls media_url as part of the same
      // UPDATE that marks the row deleted — cleanupInactiveRooms' 90-day sweep finds files solely
      // via a live media_url column (getRoomMediaUrls), so once that column is nulled the file
      // becomes invisible to every existing cleanup mechanism, not just "orphaned until the next
      // sweep." Capturing it first and deleting the actual file here (same deleteUploadFile helper
      // the Scorpture video-delete route already uses) closes that permanently-unrecoverable gap.
      deleteUploadFile(target.media_url);
      db.deleteMessageRow(messageId);
      const room = rooms.get(ws.room);
      const entry = room && room.history.find((m) => m.id === messageId);
      if (entry) { entry.text = ''; entry.mediaUrl = null; entry.mediaType = null; entry.deleted = true; }
      broadcastRoom(ws.room, { type: 'message-deleted', messageId });
      // Deleting a pinned message previously left the pinned banner showing its now-deleted text
      // indefinitely for everyone already in the room (only a rejoin re-fetches pins from the DB
      // and picks up the change) — unpin it too and broadcast the fresh list, same as an explicit
      // unpin-message would. unpinMessage is a plain DELETE, harmless/idempotent if it wasn't pinned.
      db.unpinMessage(ws.room, messageId);
      broadcastRoom(ws.room, { type: 'pins-updated', pins: db.getPins(ws.room) });
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
      // Every sibling handler (edit/delete/pin/vote/get-thread) verifies the target message
      // belongs to the reactor's own room before acting — this one didn't, so a reaction on a
      // message ID from a different room (ids are unguessable UUIDs, so low practical risk, but
      // a real gap in an otherwise-consistent room-isolation pattern) would surface in that other
      // room's reaction list via db.getReactionsForRoom's join on room_code.
      const reactTarget = db.getMessage(messageId);
      // Matches edit-message/delete-message, which both already refuse to act on an already-
      // deleted message — this one didn't, letting a reaction badge appear on a "message
      // deleted" placeholder. Cosmetic only (still correctly self- and room-scoped either way).
      if (!reactTarget || reactTarget.room_code !== ws.room || reactTarget.deleted) return;
      // Reactions are still a form of expression a mute is meant to stop — a muted user could
      // otherwise keep reacting (including provocatively) with no restriction at all.
      const reactRoom = rooms.get(ws.room);
      if (reactRoom && reactRoom.muted && reactRoom.muted.has(ws.profile.name)) return;
      // Same flood gate as regular messages — each toggle is a DB write plus a room-wide
      // broadcast, previously unthrottled.
      if (isWsMsgRateLimited(ws)) return;
      const added = db.toggleReaction(messageId, emoji, ws.profile.name);
      broadcastRoom(ws.room, { type: 'reaction', messageId, emoji, name: ws.profile.name, added });
      return;
    }

    if (msg.type === 'pin-message' && ws.room) {
      // Same flood gate every other content-mutating path shares — any room member (not just the
      // host) can pin/unpin, and each call does a DB write plus a room-wide broadcast of the full
      // pins list, with no throttle before this.
      if (isWsMsgRateLimited(ws)) return;
      const messageId = String(msg.messageId || '');
      const target = db.getMessage(messageId);
      if (!target || target.room_code !== ws.room) return;
      db.setPin(ws.room, messageId, ws.profile.name);
      broadcastRoom(ws.room, { type: 'pins-updated', pins: db.getPins(ws.room) });
      return;
    }

    if (msg.type === 'unpin-message' && ws.room) {
      if (isWsMsgRateLimited(ws)) return;
      const messageId = String(msg.messageId || '');
      db.unpinMessage(ws.room, messageId);
      broadcastRoom(ws.room, { type: 'pins-updated', pins: db.getPins(ws.room) });
      return;
    }

    if (msg.type === 'typing' && ws.room) {
      // The real client already self-throttles to one 'typing' send per 2s (see app.js), but
      // unlike every other message-creation path in this app, this handler had zero server-side
      // rate limiting of its own — a raw WS client ignoring that throttle could flood every other
      // room member's socket with 'typing' broadcasts. Same shared gate as chat messages/reactions/
      // Scorpture watch-live etc: cheap for a real user (well under budget at 1 send/2s), closes
      // the flood off for anyone bypassing the client.
      if (isWsMsgRateLimited(ws)) return;
      broadcastRoom(ws.room, { type: 'typing', name: ws.profile.name }, ws);
      return;
    }

    if (msg.type === 'read' && ws.room) {
      const messageId = String(msg.messageId || '');
      if (!messageId) return;
      // A real DB write (setReadReceipt) plus a room-wide broadcast on every call, with no
      // server-side throttle of its own — a raw WS client could hammer the DB with unbounded
      // upserts. Uses the generous per-stroke gate rather than the standard 8/6s chat one: unlike
      // 'typing' (bounded by one person's own input rate, already client-throttled to 1/2s), a
      // legitimate 'read' fires once per *incoming* message — in a genuinely busy room that's
      // bounded by the room's aggregate traffic across every sender, not any single person's rate,
      // so the tighter gate risked dropping real read receipts during ordinary heavy chat activity.
      if (isStrokeRateLimited(ws)) return;
      // Same room-ownership check every sibling handler (edit/delete/pin/vote/get-thread/react)
      // already has — this one was the one gap left. Practically low-risk on its own (ids are
      // unguessable random UUIDs, and the client only ever compares receipts by exact string
      // equality against its own room's last message id — see renderSeenBy in app.js — so a
      // cross-room id just silently never matches anything), but consistent with the rest of the
      // room-isolation pattern rather than leaving one handler as the odd one out.
      const readTarget = db.getMessage(messageId);
      if (!readTarget || readTarget.room_code !== ws.room) return;
      db.setReadReceipt(ws.room, ws.profile.name, messageId);
      broadcastRoom(ws.room, { type: 'read-receipt', name: ws.profile.name, messageId }, ws);
      return;
    }
    } catch (err) {
      // Same reasoning as the try/catch inside ws.on('error', ...) above: this whole outer
      // try/catch exists so a bug in any single message handler can't kill this connection's
      // message loop (or the whole process) — but if reportError itself throws (a synchronous DB
      // write failing), that exception would propagate back out through ws's own internal emit()
      // call stack the exact same way, defeating the entire point of this catch block existing.
      try {
        reportError('server', err, { wsMessageType: msg && msg.type, room: ws.room || null });
      } catch {
        // Deliberately swallowed.
      }
    }
  });

  ws.on('close', () => {
    unregisterAccountConnection(ws);
    if (ws.room) leaveRoom(ws);
    if (ws.profile) broadcastWorldwideCount();
    if (ws.bcRoom) leaveBc(ws);
    if (ws.gwRoom) leaveGw(ws);
    if (ws.swRoom) leaveSw(ws);
    if (ws.fgRoom) leaveFg(ws);
    if (ws.bbRoom) leaveBb(ws);
    if (ws.dgRoom) leaveDg(ws);
    if (ws.wbRoom) leaveWb(ws);
    if (ws.tvRoom) leaveTv(ws);
    if (ws.ttRoom) leaveTt(ws);
    if (ws.chRoom) leaveCh(ws);
    if (ws.hmRoom) leaveHm(ws);
    if (ws.arcadeRoom && ws.arcadeName) clearRoomActivity(ws.arcadeRoom, ws.arcadeName);
    // Only end the stream if this closing socket is the one actually on file — see the identity
    // guard added to scorpture-go-live/scorpture-end-live above; without it, a stale tab that had
    // already been superseded by a newer "go live" from the same account would kill the newer,
    // actually-live stream's real viewers the moment it finally closed.
    if (ws.accountId) {
      const liveStream = liveStreams.get(ws.accountId);
      if (liveStream && liveStream.ws === ws) endScorptureLive(ws.accountId);
    }
    leaveScorptureLive(ws);
  });
});

// ---- Persistent data retention — DB rows and public/uploads/ files never expired before, so
// a long-running install grows forever. Rooms untouched for ROOM_RETENTION_DAYS (tracked via
// rooms.last_active_at, bumped by any real activity — see the db.upsertRoom callers above) get
// fully purged: messages, reactions, pins, whiteboard strokes, Build Craft world/blueprints,
// leaderboard entries, DMs, push subscriptions, and any uploaded media those messages posted.
const ROOM_RETENTION_DAYS = 90;
// Overridable in milliseconds so the regression suite can verify a real purge (and everything it
// should cascade-delete) in milliseconds instead of waiting 90 real days — same pattern as
// UPLOAD_CLAIM_GRACE_MS below. Unset in production, so this has no effect there.
const ROOM_RETENTION_MS = Number(process.env.ROOM_RETENTION_MS ?? ROOM_RETENTION_DAYS * 24 * 60 * 60 * 1000);
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function deleteUploadFile(mediaUrl) {
  if (typeof mediaUrl !== 'string' || !mediaUrl.startsWith('/uploads/')) return;
  const uploadsDir = path.join(__dirname, 'public/uploads');
  const resolved = path.join(__dirname, 'public', mediaUrl);
  if (!resolved.startsWith(uploadsDir + path.sep)) return; // guard against a stray '..' in a stored URL
  fs.unlink(resolved, () => {}); // best-effort — already-missing file isn't an error here
}

function cleanupInactiveRooms() {
  const cutoff = Date.now() - ROOM_RETENTION_MS;
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

// See pendingUploads/claimUpload near the /upload route above for why this exists. Generous grace
// period — real flows (AI Studio's caption-then-upload-then-post, the video editor's "send to
// chat" happening well after editing) can legitimately take a while between upload and claim —
// balanced against not leaving a sustained-abuse window open too long.
// Overridable via env so the regression suite can verify real sweep behavior in milliseconds
// instead of minutes — unset in production, so this has no effect there.
const UPLOAD_CLAIM_GRACE_MS = Number(process.env.UPLOAD_CLAIM_GRACE_MS ?? 15 * 60 * 1000);
const UPLOAD_SWEEP_INTERVAL_MS = Number(process.env.UPLOAD_SWEEP_INTERVAL_MS ?? 5 * 60 * 1000);
function sweepOrphanedUploads() {
  const cutoff = Date.now() - UPLOAD_CLAIM_GRACE_MS;
  let swept = 0;
  for (const [url, uploadedAt] of pendingUploads) {
    if (uploadedAt > cutoff) continue;
    deleteUploadFile(url);
    pendingUploads.delete(url);
    swept += 1;
  }
  if (swept) console.log(`[cleanup] Swept ${swept} orphaned upload(s) never attached to anything.`);
  return swept;
}
setInterval(sweepOrphanedUploads, UPLOAD_SWEEP_INTERVAL_MS);

app.post('/admin/cleanup/run', requireAdmin, (req, res) => {
  try {
    res.json({ ok: true, ...cleanupInactiveRooms() });
  } catch (err) {
    reportError('server', err, { path: req.path, method: req.method });
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Express error-handling middleware — must be registered after every route above. Catches
// synchronous throws, anything passed to next(err), AND a rejected promise from an async route
// handler (Express 5+ wraps every handler and forwards a rejection to next(err) automatically —
// unlike Express 4, where an uncaught async rejection needed its own try/catch or it just hung).
// Verified against this project's actual installed version (5.2.1), not assumed from changelog.
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
  if (room.fg && room.fg.players && room.fg.players.size > 0) return false;
  if (room.tv && room.tv.players && room.tv.players.size > 0) return false;
  if (room.dg && room.dg.players && room.dg.players.size > 0) return false;
  // wb/tt/ch/hm were missing here — a room with players only in whiteboard, tic-tac-toe/
  // connect4, chess, or hangman (no one in main chat/voice/other games) looked "fully empty"
  // and got swept by the 10-minute interval below even with live connections still playing,
  // silently dropping their moves/strokes from that point on.
  if (room.wb && room.wb.players && room.wb.players.size > 0) return false;
  if (room.tt && room.tt.players && room.tt.players.size > 0) return false;
  if (room.ch && room.ch.players && room.ch.players.size > 0) return false;
  if (room.hm && room.hm.players && room.hm.players.size > 0) return false;
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
