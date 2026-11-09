// Adds "📣 Invite the chat room" to a minigame's lobby panel. Uses its own short-lived WebSocket
// (each game page keeps its own connection; this doesn't touch it). The game is named by
// <script src="game-invite.js" data-game="wordguess">.
(function () {
  const script = document.currentScript;
  const game = script && script.dataset.game;
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  const name = (params.get('name') || '').slice(0, 30);
  if (!game || !room || !name) return;
  const panel = document.querySelector('#lobby .panel');
  const floating = script.dataset.float === '1';
  if (!panel && !floating) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '📣 Invite the chat room';
  btn.style.cssText = 'display:block;width:100%;margin-top:0.6rem;padding:0.6rem;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:inherit;font:inherit;font-weight:600;cursor:pointer;';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Sending…';
    const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
    const done = (label) => { btn.textContent = label; setTimeout(() => { btn.disabled = false; btn.textContent = '📣 Invite the chat room'; }, 30000); try { sock.close(); } catch (e) { /* ignore */ } };
    sock.addEventListener('open', () => sock.send(JSON.stringify({ type: 'game-invite', game, code: room, name })));
    sock.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'game-invite-sent') done('📣 Invite sent!');
      else if (m.type === 'error') done(m.message || "Couldn't send");
    });
    setTimeout(() => { if (btn.textContent === 'Sending…') done("Couldn't send — is anyone in the chat?"); }, 4000);
  });
  if (floating) {
    // Pages whose lobby disappears once you're seated (chess, tic-tac-toe): a small pill in the
    // top-right corner instead, out of the way of the board.
    btn.style.cssText = 'position:fixed;top:0.75rem;right:0.75rem;z-index:40;padding:0.45rem 0.9rem;border-radius:999px;border:1px solid rgba(255,255,255,0.15);background:rgba(6,14,22,0.75);backdrop-filter:blur(10px);color:#eaf6ff;font:inherit;font-size:0.85rem;font-weight:600;cursor:pointer;';
    btn.textContent = '📣 Invite';
    document.body.appendChild(btn);
    const reset = btn.textContent;
    new MutationObserver(() => { if (!btn.disabled && btn.textContent === '📣 Invite the chat room') btn.textContent = reset; }).observe(btn, { childList: true });
  } else {
    panel.appendChild(btn);
  }
})();
