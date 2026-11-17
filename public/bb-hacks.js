// Fight for Glory — Admin Hacks panel.
// Only shows up for accounts the server says are admins (BB_HACK_ADMINS in server.js: supdid67 and
// asher). Loaded after blockbattle.js as a classic script, so it shares that file's top-level
// variables (bbHacks, player, coins, ownedSkins, ...) directly.
// Open/close with the ` (backtick) key or the 🛠️ button. Hacks never count toward leaderboards.
(function () {
  const HACKS = [
    ['noclip', '👻 No Clip', 'Walk through walls and towers'],
    ['fly', '🕊️ Fly', 'Space = up, Ctrl/C = down'],
    ['god', '🛡️ God Mode', "Can't take damage (works online too)"],
    ['infammo', '♾️ Infinite Ammo', 'Never reload'],
    ['onehit', '💥 One-Hit Kills', 'Every hit kills (works online too)'],
    ['rapid', '⚡ Rapid Fire', 'Shoot about 4x faster'],
    ['speed', '🏃 Super Speed', 'Move 2.5x faster'],
    ['superjump', '🦘 Super Jump', 'Jump about 5x higher'],
    ['infrange', '🎯 Infinite Range', 'Online shots hit from any distance'],
  ];

  let isAdmin = false;
  let panel = null;
  let btn = null;

  function token() {
    try { return localStorage.getItem('valk-account-token') || ''; } catch { return ''; }
  }

  function sendServerHacks() {
    if (!isAdmin || typeof bbWs === 'undefined' || !bbWs || bbWs.readyState !== WebSocket.OPEN) return;
    bbWs.send(JSON.stringify({ type: 'bb-admin-hacks', hacks: { god: bbHacks.god, onehit: bbHacks.onehit, rapid: bbHacks.rapid, infrange: bbHacks.infrange } }));
  }
  // Called by blockbattle.js's bb-init handler whenever an admin (re)joins the online lobby, so the
  // server learns which hacks are already switched on.
  window.bbHacksOnJoin = sendServerHacks;

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'bbh-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  function setHack(key, on) {
    bbHacks[key] = on;
    if (on) bbHacksUsed = true;
    if (key === 'fly' && !on) { vy = 0; }
    if (key === 'god' && on && typeof updateHealthBar === 'function') { health = MAX_HEALTH; updateHealthBar(); }
    if (key === 'infammo' && on && typeof WEAPONS !== 'undefined' && WEAPONS[weapon]) {
      isReloading = false; ammo = WEAPONS[weapon].mag; updateAmmoHud();
    }
    sendServerHacks();
    render();
  }

  function giveCoins() {
    bbHacksUsed = true;
    awardCoins(100000);
    toast('+100,000 coins');
  }

  function unlockAll() {
    bbHacksUsed = true;
    for (const s of BB_SKINS) ownedSkins.add(s.id);
    for (const a of BB_AVATARS) ownedSkins.add(a.id);
    saveOwnedSkins(ownedSkins);
    for (const w of SHOP_WEAPONS) purchasedWeapons.add(w.id);
    savePurchased(purchasedWeapons);
    toast('Unlocked every skin, avatar and shop weapon');
  }

  function heal() {
    health = MAX_HEALTH;
    updateHealthBar();
    toast('Healed to full');
  }

  function teleportTo(id) {
    const rp = bbRemotePlayers.get(id);
    if (!rp) return;
    bbHacksUsed = true;
    player.x = rp.target.x + 1;
    player.y = rp.target.y;
    player.z = rp.target.z;
    vy = 0;
    toast('Teleported to ' + rp.name);
  }

  function allOff() {
    for (const [k] of HACKS) bbHacks[k] = false;
    sendServerHacks();
    render();
  }

  function render() {
    if (!panel) return;
    const list = panel.querySelector('.bbh-list');
    list.textContent = '';
    for (const [key, label, desc] of HACKS) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'bbh-toggle' + (bbHacks[key] ? ' on' : '');
      const name = document.createElement('span');
      name.className = 'bbh-name';
      name.textContent = label;
      const sub = document.createElement('span');
      sub.className = 'bbh-desc';
      sub.textContent = desc;
      const pill = document.createElement('span');
      pill.className = 'bbh-pill';
      pill.textContent = bbHacks[key] ? 'ON' : 'OFF';
      row.append(name, pill, sub);
      row.addEventListener('click', () => setHack(key, !bbHacks[key]));
      list.appendChild(row);
    }
    const tp = panel.querySelector('.bbh-tp');
    tp.textContent = '';
    const others = typeof onlineActive !== 'undefined' && onlineActive ? [...bbRemotePlayers.entries()] : [];
    if (!others.length) {
      const none = document.createElement('div');
      none.className = 'bbh-desc';
      none.textContent = 'Join Online Play to teleport to other players.';
      tp.appendChild(none);
    }
    for (const [id, rp] of others) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bbh-action';
      b.textContent = '📍 ' + rp.name;
      b.addEventListener('click', () => teleportTo(id));
      tp.appendChild(b);
    }
  }

  function toggle() {
    if (!panel) return;
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (opening) {
      render();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  function build() {
    const style = document.createElement('style');
    style.textContent = `
      #bbh-btn { position: fixed; right: 12px; bottom: 12px; z-index: 9998; background: #1a1404; color: #ffd54a;
        border: 2px solid #ffd54a; border-radius: 10px; padding: 8px 12px; font: bold 14px sans-serif; cursor: pointer; }
      #bbh-panel { position: fixed; right: 12px; bottom: 60px; z-index: 9999; width: min(340px, calc(100vw - 24px));
        max-height: calc(100vh - 80px); overflow-y: auto; background: rgba(14,11,3,0.96); color: #fff;
        border: 2px solid #ffd54a; border-radius: 14px; padding: 12px; font-family: sans-serif; box-shadow: 0 8px 30px #000a; }
      #bbh-panel.hidden { display: none; }
      #bbh-panel h2 { margin: 0 0 2px; font-size: 18px; color: #ffd54a; }
      #bbh-panel h3 { margin: 12px 0 6px; font-size: 13px; color: #ffd54a; text-transform: uppercase; letter-spacing: .05em; }
      .bbh-note { font-size: 12px; color: #bbb; margin-bottom: 8px; }
      .bbh-list { display: grid; gap: 6px; }
      .bbh-toggle { display: grid; grid-template-columns: 1fr auto; text-align: left; gap: 2px 8px; width: 100%;
        background: #2a2410; color: #fff; border: 1px solid #554a20; border-radius: 8px; padding: 7px 10px; cursor: pointer; }
      .bbh-toggle.on { background: #3d5a12; border-color: #9be04a; }
      .bbh-name { font-weight: bold; font-size: 14px; }
      .bbh-desc { grid-column: 1 / -1; font-size: 11px; color: #c8c8c8; }
      .bbh-pill { font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 999px; background: #000; color: #f66; align-self: center; }
      .bbh-toggle.on .bbh-pill { color: #9be04a; }
      .bbh-actions, .bbh-tp { display: flex; flex-wrap: wrap; gap: 6px; }
      .bbh-action { background: #ffd54a; color: #1a1404; border: 0; border-radius: 8px; padding: 7px 10px; font-weight: bold; cursor: pointer; }
      .bbh-action.off { background: #444; color: #fff; }
      .bbh-toast { position: fixed; left: 50%; top: 18%; transform: translateX(-50%); z-index: 10000; background: #1a1404;
        color: #ffd54a; border: 2px solid #ffd54a; border-radius: 10px; padding: 8px 14px; font: bold 15px sans-serif; pointer-events: none; }
    `;
    document.head.appendChild(style);

    btn = document.createElement('button');
    btn.id = 'bbh-btn';
    btn.type = 'button';
    btn.textContent = '🛠️ Admin';
    btn.title = 'Admin Hacks (` key)';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);

    panel = document.createElement('div');
    panel.id = 'bbh-panel';
    panel.className = 'hidden';
    panel.innerHTML = `
      <h2>🛠️ Admin Hacks</h2>
      <div class="bbh-note">Only you can see this. Press <b>\`</b> to open/close. Anything you do with hacks on won't count on leaderboards.</div>
      <div class="bbh-list"></div>
      <h3>Extras</h3>
      <div class="bbh-actions">
        <button type="button" class="bbh-action" data-a="coins">💰 +100k Coins</button>
        <button type="button" class="bbh-action" data-a="unlock">🔓 Unlock Everything</button>
        <button type="button" class="bbh-action" data-a="heal">❤️ Full Heal</button>
        <button type="button" class="bbh-action off" data-a="off">⛔ All Hacks Off</button>
      </div>
      <h3>Teleport</h3>
      <div class="bbh-tp"></div>`;
    panel.querySelector('[data-a="coins"]').addEventListener('click', giveCoins);
    panel.querySelector('[data-a="unlock"]').addEventListener('click', unlockAll);
    panel.querySelector('[data-a="heal"]').addEventListener('click', heal);
    panel.querySelector('[data-a="off"]').addEventListener('click', allOff);
    document.body.appendChild(panel);

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Backquote') { e.preventDefault(); toggle(); }
    });
  }

  const t = token();
  if (!t) return;
  fetch('/api/bb/admin', { headers: { Authorization: 'Bearer ' + t } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.admin) return;
      isAdmin = true;
      build();
      sendServerHacks();
    })
    .catch(() => {});
})();
