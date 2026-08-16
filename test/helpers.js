// Shared plumbing for the regression suite in this directory. Spins up a real `node server.js`
// process (not a mock) against a disposable scratch copy — same "fresh DB, spare port, own vapid
// keys, scratch-test-then-verify" discipline every ad-hoc bug-hunt session this app has gone
// through has used, just persisted here instead of being rewritten from scratch each time.
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'));

const REPO_ROOT = path.join(__dirname, '..');
const TEST_PORT = 3199; // dedicated to this suite — distinct from the 3099 convention used for
// ad-hoc manual scratch-testing, so a stray manual session and `npm test` never collide.
const BASE_URL = `http://localhost:${TEST_PORT}`;
const WS_URL = `ws://localhost:${TEST_PORT}`;

// Starts a scratch server instance and resolves once it's actually accepting connections.
// node_modules and public/ are symlinked (62MB+, and tests never need to modify either) rather
// than copied — only the small root server-side files get a real copy, into a fresh temp dir so
// each test file run gets its own DB/keys with zero chance of touching the real ~/chat-app data.
async function startTestServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'valk-test-'));
  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  fs.symlinkSync(path.join(REPO_ROOT, 'public'), path.join(dir, 'public'));
  for (const file of ['server.js', 'db.js', 'patcher.js', 'package.json']) {
    fs.copyFileSync(path.join(REPO_ROOT, file), path.join(dir, file));
  }
  const webpush = require(path.join(REPO_ROOT, 'node_modules', 'web-push'));
  fs.writeFileSync(path.join(dir, 'vapid-keys.json'), JSON.stringify(webpush.generateVAPIDKeys()));

  const proc = spawn('node', ['server.js'], {
    cwd: dir,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', (d) => { output += d; });
  proc.stderr.on('data', (d) => { output += d; });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.status === 200) break;
    } catch { /* not up yet */ }
    if (proc.exitCode !== null) {
      throw new Error(`test server exited early (code ${proc.exitCode}):\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    dir,
    proc,
    getOutput: () => output,
    async stop() {
      proc.kill();
      await new Promise((r) => proc.once('exit', r));
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function connectWs() {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
  });
}
function send(ws, obj) { ws.send(JSON.stringify(obj)); }
function waitFor(ws, pred, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message matching ' + pred.toString())), timeoutMs);
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (pred(msg)) { clearTimeout(timer); ws.off('message', handler); resolve(msg); }
    };
    ws.on('message', handler);
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { startTestServer, connectWs, send, waitFor, sleep, BASE_URL, WS_URL };
