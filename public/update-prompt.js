// Valk update gate.
//
// Shows a full-screen black overlay with a single green Update button when — and only when — a new
// version of the app is waiting to install. Pressing it activates the new service worker and
// reloads, which is what actually pulls new/changed pages, scripts and cached images onto a device
// that already has Valk installed.
//
// This file also does the service-worker registration for every page, replacing the inline snippet
// each page used to carry. Registering the same URL twice is harmless (the browser returns the
// existing registration), so admin.html's own push-notification registration still works alongside
// this one.
//
// Pairs with sw.js, which deliberately does NOT call skipWaiting() on install any more — without a
// worker sitting in the "waiting" state there is no update to detect, and the button would have
// nothing to press. sw.js activates only when this file sends it SKIP_WAITING.
(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  const UPDATE_CHECK_MS = 60 * 1000;  // long-lived tab notices a deploy without needing a reload
  const RELOAD_FALLBACK_MS = 6000;    // if activation stalls, reload anyway rather than trap the user

  let waitingWorker = null;
  let userTriggered = false;
  let reloading = false;
  let ui = null;

  function buildUI() {
    if (ui) return ui;

    const style = document.createElement('style');
    style.textContent = `
      #vk-update-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        background: #000;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        text-align: center;
        padding: 24px;
        box-sizing: border-box;
      }
      #vk-update-overlay.vk-show { display: flex; }
      #vk-update-logo { width: 72px; height: 72px; border-radius: 16px; }
      #vk-update-title { margin: 0; font-size: 1.6rem; font-weight: 800; letter-spacing: 0.01em; }
      #vk-update-sub { margin: 0; font-size: 0.95rem; color: #9aa4b2; max-width: 30rem; line-height: 1.5; }
      #vk-update-btn {
        margin-top: 6px;
        min-width: 200px;
        padding: 15px 34px;
        font-size: 1.05rem;
        font-weight: 800;
        font-family: inherit;
        color: #05130a;
        background: linear-gradient(180deg, #3ee87f, #21c162);
        border: none;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: 0 0 26px rgba(62, 232, 127, 0.45);
        transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
      }
      #vk-update-btn:hover { transform: translateY(-1px); box-shadow: 0 0 34px rgba(62, 232, 127, 0.65); }
      #vk-update-btn:active { transform: translateY(1px); }
      #vk-update-btn[disabled] { filter: saturate(0.4) brightness(0.8); cursor: default; transform: none; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'vk-update-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'vk-update-title');

    const logo = document.createElement('img');
    logo.id = 'vk-update-logo';
    logo.src = '/images/logo.png';
    logo.alt = '';
    // The logo is a nicety, not a dependency — a missing or uncached image must not leave a broken
    // icon sitting in the middle of an otherwise deliberate black screen.
    logo.addEventListener('error', () => logo.remove());

    const title = document.createElement('h1');
    title.id = 'vk-update-title';
    title.textContent = 'Update available';

    const sub = document.createElement('p');
    sub.id = 'vk-update-sub';
    sub.textContent = 'A new version of Valk is ready to install.';

    const btn = document.createElement('button');
    btn.id = 'vk-update-btn';
    btn.type = 'button';
    btn.textContent = 'Update';

    overlay.append(logo, title, sub, btn);
    document.body.appendChild(overlay);

    btn.addEventListener('click', () => {
      if (!waitingWorker || userTriggered) return;
      userTriggered = true;
      btn.disabled = true;
      btn.textContent = 'Updating…';
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      // Activation normally fires controllerchange within a few hundred ms. If something goes wrong
      // there is no way out of a full-screen gate, so reload regardless rather than strand anyone.
      setTimeout(() => {
        if (reloading) return;
        reloading = true;
        location.reload();
      }, RELOAD_FALLBACK_MS);
    });

    ui = { overlay, btn };
    return ui;
  }

  function showUpdate(worker) {
    waitingWorker = worker;
    const els = buildUI();
    els.overlay.classList.add('vk-show');
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload for an update the user actually asked for. sw.js calls clients.claim(), so this
    // event also fires on a brand-new install — reloading there would bounce first-time visitors.
    if (!userTriggered || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // An existing controller is what separates "an update is waiting" from "this is the first
      // install". Without that check every new visitor would be met with the black update screen.
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener('statechange', () => {
          if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdate(incoming);
          }
        });
      });

      setInterval(() => { reg.update().catch(() => { /* offline, try again next tick */ }); }, UPDATE_CHECK_MS);
    }).catch(() => { /* registration blocked (private mode, insecure origin) — app still works */ });
  });
})();
