// Self-healing: report uncaught errors so the server can log them and draft a fix
// (see reportError()/patcher.js on the server) — best-effort, never throws itself.
// Shared by every minigame/tool page; app.js keeps its own copy for the main chat page.
function reportClientError(message, stack) {
  fetch('/errors/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: String(message).slice(0, 2000), stack: stack || null, url: location.href }),
  }).catch(() => {});
}
window.addEventListener('error', (e) => {
  reportClientError(e.message, e.error && e.error.stack);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  reportClientError(reason && reason.message ? reason.message : String(reason), reason && reason.stack);
});
