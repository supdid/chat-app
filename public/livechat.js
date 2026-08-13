// Standalone pop-out live chat — opened via window.open() from videos.js's "⤢ Pop out" button,
// same origin as the main app so it shares localStorage (account token) automatically. Deliberately
// minimal: no video, no page chrome, just the chat — meant to be resized down small and kept
// off to the side while the stream itself plays in the original tab/window.
const ACCOUNT_TOKEN_KEY = 'valk-account-token';

function getToken() {
  return localStorage.getItem(ACCOUNT_TOKEN_KEY) || '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

const streamerNameEl = document.getElementById('streamer-name');
const connStatusEl = document.getElementById('conn-status');
const stateMsgEl = document.getElementById('state-msg');
const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const params = new URLSearchParams(location.search);
const streamerUsername = params.get('u') || '';
streamerNameEl.textContent = streamerUsername ? `${streamerUsername}'s chat` : 'Live chat';
document.title = streamerUsername ? `${streamerUsername} — Live chat` : 'Valk — Live chat';

function showState(text) {
  if (!text) { stateMsgEl.classList.add('hidden'); return; }
  stateMsgEl.textContent = text;
  stateMsgEl.classList.remove('hidden');
}

function appendMessage(data) {
  const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 40;
  const row = document.createElement('div');
  row.className = 'live-chat-message';
  row.innerHTML = `<span class="live-chat-author">${escapeHtml(data.username)}</span>${escapeHtml(data.text)}`;
  messagesEl.appendChild(row);
  if (atBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

let ws = null;
let signedIn = false;

function connectWs() {
  connStatusEl.textContent = 'connecting…';
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'scorpture-hello', accountToken: getToken() }));
  });
  ws.addEventListener('close', () => {
    connStatusEl.textContent = 'reconnecting…';
    setTimeout(connectWs, 1500);
  });
  ws.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    handleMessage(data);
  });
}

function handleMessage(data) {
  if (data.type === 'scorpture-hello-ack') {
    signedIn = !!data.username;
    chatInput.disabled = !signedIn;
    chatInput.placeholder = signedIn ? 'Say something…' : 'Sign in on the main tab to chat';
    if (!streamerUsername) { showState('No streamer specified.'); return; }
    ws.send(JSON.stringify({ type: 'scorpture-watch-live', streamerUsername }));
    return;
  }
  if (data.type === 'scorpture-watch-ack') {
    connStatusEl.textContent = data.live ? 'live' : '';
    showState(data.live ? '' : `${streamerUsername} isn't live right now.`);
    return;
  }
  if (data.type === 'scorpture-live-chat') {
    appendMessage(data);
    return;
  }
  if (data.type === 'scorpture-stream-ended') {
    showState(`${streamerUsername}'s stream ended.`);
    connStatusEl.textContent = '';
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!signedIn || !ws || ws.readyState !== WebSocket.OPEN) return;
  const text = chatInput.value.trim();
  if (!text) return;
  ws.send(JSON.stringify({ type: 'scorpture-live-chat', text }));
  chatInput.value = '';
});

connectWs();
