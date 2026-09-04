// --- Theme (same toggle behavior as the main chat page) ---
const themeToggleBtn = document.getElementById('theme-toggle-btn');

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
    themeToggleBtn.textContent = '☀️';
  } else {
    delete document.documentElement.dataset.theme;
    themeToggleBtn.textContent = '🌙';
  }
}

applyTheme(localStorage.getItem('valk-theme') === 'light' ? 'light' : 'dark');

themeToggleBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  // A throw here previously aborted applyTheme() below too, making the toggle look unresponsive.
  try { localStorage.setItem('valk-theme', next); } catch {}
  applyTheme(next);
});

// --- Carry the room/name from the chat page so "Send to chat" knows where to post ---
const params = new URLSearchParams(location.search);
const roomCode = params.get('room');
const myName = params.get('name');
const roomPin = params.get('pin') || '';
if (roomCode && myName) {
  document.getElementById('back-link').href = `index.html?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(myName)}`;
}

// --- Elements ---
const form = document.getElementById('generate-form');
const promptInput = document.getElementById('prompt-input');
const ratioSelect = document.getElementById('ratio-select');
const generateBtn = document.getElementById('generate-btn');
const errorEl = document.getElementById('studio-error');
const resultCard = document.getElementById('result-card');
const resultImg = document.getElementById('result-img');
const resultLoading = document.getElementById('result-loading');
const resultPrompt = document.getElementById('result-prompt');
const regenerateBtn = document.getElementById('regenerate-btn');
const downloadBtn = document.getElementById('download-btn');
const sendChatBtn = document.getElementById('send-chat-btn');
const gallerySection = document.getElementById('gallery-section');
const galleryGrid = document.getElementById('gallery-grid');
const clearGalleryBtn = document.getElementById('clear-gallery-btn');
const categoryRow = document.getElementById('category-row');
const categoryHint = document.getElementById('category-hint');
const quickIdeasRow = document.getElementById('quick-ideas-row');
const memeFields = document.getElementById('meme-fields');
const memeTopInput = document.getElementById('meme-top-input');
const memeBottomInput = document.getElementById('meme-bottom-input');
const progressFill = document.getElementById('progress-fill');
const loadingStatus = document.getElementById('loading-status');

if (roomCode && myName) sendChatBtn.classList.remove('hidden');

// --- Categories: each is a style "flavor" added on top of the user's prompt, plus a
// row of one-tap example prompts so a beginner has somewhere to start from scratch.
// "Game Art" makes game-style artwork/concept art (a still picture) — not an actual
// playable game, which free image generation can't produce; the hint line says so.
const CATEGORIES = [
  {
    id: 'general',
    label: '✨ General',
    hint: 'Describe anything — no extra style is added.',
    suffix: '',
    ideas: ['a cozy cabin in the snow', 'a futuristic city skyline at night', 'a bowl of fresh fruit, studio photo'],
  },
  {
    id: 'game',
    label: '🎮 Game Art',
    hint: 'Video-game-style concept art — a picture, not a playable game.',
    suffix: ', video game concept art, digital painting, dramatic lighting, highly detailed',
    ideas: ['a fierce armored warrior character', 'a sprawling fantasy RPG landscape', 'a cute platformer game mascot', 'a cyberpunk city level'],
  },
  {
    id: 'animals',
    label: '🐾 Animals',
    hint: 'Photorealistic animal portraits.',
    suffix: ', photorealistic, detailed fur, natural lighting, high quality photo',
    ideas: ['a fluffy golden retriever puppy', 'a majestic lion in the savanna', 'a colorful parrot on a branch', 'a sleepy orange cat in sunlight'],
  },
  {
    id: 'meme',
    label: '😂 Memes',
    hint: 'Pick a background, add top/bottom text — a real captioned meme.',
    suffix: ', meme template background, simple, bold colors, clear focal point',
    ideas: ['a surprised cat', 'a confused man looking at a math problem', 'a dog side-eyeing the camera', 'a galaxy brain'],
  },
  {
    id: 'fantasy',
    label: '🐉 Fantasy',
    hint: 'Dragons, magic, and epic worlds.',
    suffix: ', fantasy art, epic scale, magical atmosphere, intricate detail',
    ideas: ['a dragon perched on a castle tower', 'a wizard casting a glowing spell', 'an enchanted glowing forest', 'a floating island in the clouds'],
  },
  {
    id: 'space',
    label: '🚀 Space',
    hint: 'Sci-fi and cosmic scenes.',
    suffix: ', sci-fi digital art, cosmic, vibrant nebula colors, high detail',
    ideas: ['an astronaut on an alien planet', 'a spaceship flying through a nebula', 'a distant galaxy full of stars', 'a robot exploring Mars'],
  },
  {
    id: 'anime',
    label: '🎨 Anime',
    hint: 'Anime and cartoon style art.',
    suffix: ', anime style, vibrant colors, cel shaded, studio quality',
    ideas: ['a magical girl with a glowing sword', 'a cheerful anime mascot character', 'a cyberpunk anime city street', 'a chibi cute character'],
  },
];

let activeCategory = CATEGORIES[0];

function renderCategories() {
  categoryRow.innerHTML = '';
  for (const cat of CATEGORIES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'category-chip' + (cat.id === activeCategory.id ? ' active' : '');
    chip.textContent = cat.label;
    chip.addEventListener('click', () => {
      activeCategory = cat;
      renderCategories();
      renderQuickIdeas();
      memeFields.classList.toggle('hidden', cat.id !== 'meme');
      categoryHint.textContent = cat.hint;
    });
    categoryRow.appendChild(chip);
  }
  categoryHint.textContent = activeCategory.hint;
}

function renderQuickIdeas() {
  quickIdeasRow.innerHTML = '';
  for (const idea of activeCategory.ideas) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quick-idea-chip';
    chip.textContent = idea;
    chip.addEventListener('click', () => {
      promptInput.value = idea;
      promptInput.focus();
    });
    quickIdeasRow.appendChild(chip);
  }
}

memeFields.classList.toggle('hidden', activeCategory.id !== 'meme');
renderCategories();
renderQuickIdeas();

let currentPrompt = '';
let currentUrl = '';

// --- Loading screen animation (fake progress — Pollinations gives no real progress
// events, so this eases toward 90% and only jumps to 100% once the picture is actually
// back, which keeps it honest rather than showing a bar that finishes early). ---
const LOADING_MESSAGES = ['🎨 Mixing colors…', '🖌️ Sketching the scene…', '✨ Adding details…', '🌈 Blending light and shadow…', '🪄 Almost there…'];
let progressTimer = null;
let messageTimer = null;

function startLoadingAnimation() {
  let progress = 4;
  progressFill.style.width = progress + '%';
  let messageIndex = 0;
  loadingStatus.textContent = LOADING_MESSAGES[0];
  clearInterval(progressTimer);
  clearInterval(messageTimer);
  progressTimer = setInterval(() => {
    progress += (90 - progress) * 0.09 + 0.3;
    if (progress > 90) progress = 90;
    progressFill.style.width = progress + '%';
  }, 220);
  messageTimer = setInterval(() => {
    messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
    loadingStatus.textContent = LOADING_MESSAGES[messageIndex];
  }, 1700);
}

function stopLoadingAnimation(success) {
  clearInterval(progressTimer);
  clearInterval(messageTimer);
  if (success) progressFill.style.width = '100%';
}

// --- Generation (Pollinations.ai — free, no signup, no API key) ---
const enhanceCheckbox = document.getElementById('enhance-checkbox');

// private=true keeps generations off Pollinations' own public feed (pollinations.ai/feed) —
// people posting personal pictures through a chat app's image tool shouldn't end up there by
// default. enhance=true runs the prompt through Pollinations' own LLM to add detail before
// generating, which noticeably helps short/vague prompts (a beginner's "a dog" vs. a fuller
// description) — left as an opt-out checkbox rather than always-on since it can also drift a
// carefully-worded prompt away from exactly what was typed.
function buildImageUrl(prompt, seed) {
  const [width, height] = ratioSelect.value.split('x');
  const encoded = encodeURIComponent(prompt);
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&private=true`;
  if (enhanceCheckbox.checked) url += '&enhance=true';
  return url;
}

// --- Meme text: classic bold white-with-black-outline captions, wrapped and
// auto-shrunk to fit, drawn onto a canvas copy of the generated background. ---
function wrapLines(ctx, text, maxWidth) {
  const rawWords = text.split(/\s+/).filter(Boolean);
  // Found by the AI Studio functional-correctness audit: a single word wider than maxWidth on its
  // own can't be fixed by the whitespace-based wrapping below (there's nowhere to break it) —
  // drawCaption's shrink loop keeps shrinking until it hits its font-size floor, but if the word is
  // STILL too wide even there, it stayed on one line and rendered clipped off both canvas edges.
  // Force-break any such word into character-boundary chunks first; the loop below then treats
  // each chunk exactly like an ordinary word, so it wraps like everything else.
  const words = [];
  for (const word of rawWords) {
    if (ctx.measureText(word).width <= maxWidth) { words.push(word); continue; }
    let chunk = '';
    for (const ch of word) {
      const test = chunk + ch;
      if (chunk && ctx.measureText(test).width > maxWidth) { words.push(chunk); chunk = ch; }
      else chunk = test;
    }
    if (chunk) words.push(chunk);
  }
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCaption(ctx, text, canvasW, canvasH, position) {
  const maxWidth = canvasW * 0.9;
  const minFontSize = Math.max(14, Math.floor(canvasW / 28));
  let fontSize = Math.floor(canvasW / 10);
  let lines;
  while (true) {
    ctx.font = `bold ${fontSize}px Impact, "Arial Black", sans-serif`;
    lines = wrapLines(ctx, text.toUpperCase(), maxWidth);
    // wrapLines can't break a single overlong word onto multiple lines, so line count alone
    // isn't enough — a one-word caption can pass the <=3 check while still rendering wider
    // than the canvas. Keep shrinking until every line actually fits (or we hit the floor).
    const widestLine = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if ((lines.length <= 3 && widestLine <= maxWidth) || fontSize <= minFontSize) break;
    fontSize -= Math.max(2, Math.floor(fontSize * 0.08));
  }
  ctx.font = `bold ${fontSize}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(3, fontSize / 9);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  const lineHeight = fontSize * 1.12;
  const padding = fontSize * 0.5;
  const startY = position === 'top' ? padding + fontSize : canvasH - padding - (lines.length - 1) * lineHeight;
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.strokeText(line, canvasW / 2, y);
    ctx.fillText(line, canvasW / 2, y);
  });
}

// crossOrigin='anonymous' makes the browser require a valid CORS header on the
// response or the load fails outright — only worth that risk when we actually need
// to read the pixels back out (canvas, for meme captions). A plain picture should
// never be held to that stricter standard.
// Pollinations is a free, unauthenticated third-party API with no uptime guarantee — a stalled
// connection (accepted but never completed) would otherwise leave onload/onerror both silent
// forever, hanging the loading screen and the disabled Generate button with no way out short of
// reloading the page.
const IMAGE_LOAD_TIMEOUT_MS = 25000;
function loadImage(url, needsCors) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('Timed out waiting for the image')), IMAGE_LOAD_TIMEOUT_MS);
    if (needsCors) img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('image failed to load')); };
    img.src = url;
  });
}

// Loads the generated background; if it's a meme with caption text, composites the
// text onto a canvas and uploads the result (via the existing /upload endpoint) so it
// gets a real, shareable URL instead of a giant data: URL. Returns { url, captioned } rather
// than a bare url — every fallback path below still shows *a* picture rather than failing the
// whole generation, but the caller needs to know when captions were silently dropped so it can
// tell the user instead of claiming full success on a picture their typed captions never reached.
async function loadAndMaybeComposite(bgUrl, topText, bottomText) {
  const needsComposite = !!(topText || bottomText);
  if (!needsComposite) {
    await loadImage(bgUrl, false);
    return { url: bgUrl, captioned: false };
  }

  let img;
  try {
    img = await loadImage(bgUrl, true);
  } catch {
    // The CORS-mode load failed (e.g. a proxy/extension stripped the CORS header this
    // time) — fall back to a plain load without captions rather than failing the whole
    // generation over a picture that would otherwise have displayed just fine.
    await loadImage(bgUrl, false);
    return { url: bgUrl, captioned: false };
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (topText) drawCaption(ctx, topText, canvas.width, canvas.height, 'top');
    if (bottomText) drawCaption(ctx, bottomText, canvas.width, canvas.height, 'bottom');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return { url: bgUrl, captioned: false };
    const formData = new FormData();
    formData.append('file', blob, 'meme.jpg');
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    return res.ok && data.url ? { url: data.url, captioned: true } : { url: bgUrl, captioned: false };
  } catch {
    return { url: bgUrl, captioned: false }; // canvas blocked, or the upload failed — fall back to the plain picture
  }
}

// Pollinations' free/anonymous tier is a single shared queue (observed in practice: it can
// reject a request with a transient "queue full"/402 blip even when the very next request
// half a second later succeeds), so one silent retry after a short pause turns a lot of those
// momentary hiccups into a normal-looking generation instead of a user-facing error.
async function loadWithRetry(bgUrl, topText, bottomText) {
  try {
    return await loadAndMaybeComposite(bgUrl, topText, bottomText);
  } catch {
    await new Promise((r) => setTimeout(r, 1800));
    return await loadAndMaybeComposite(bgUrl, topText, bottomText);
  }
}

// Bumped on every generate() call *and* every gallery click (see addToGallery's click handler)
// so a still-in-flight generate() can tell, once it finally resolves, whether the user has since
// navigated to a different view (a gallery item) — without this, a slow Pollinations response
// would silently overwrite whatever the user is currently looking at moments later.
let viewToken = 0;

async function generate(prompt, seed, topText, bottomText) {
  const myToken = ++viewToken;
  errorEl.classList.add('hidden');
  resultCard.classList.remove('hidden');
  resultLoading.classList.remove('hidden');
  resultImg.classList.add('hidden');
  generateBtn.disabled = true;
  regenerateBtn.disabled = true;
  startLoadingAnimation();

  const styledPrompt = `${prompt}${activeCategory.suffix}`;
  const bgUrl = buildImageUrl(styledPrompt, seed);

  try {
    const { url: finalUrl, captioned } = await loadWithRetry(bgUrl, topText, bottomText);
    addToGallery(finalUrl, prompt);
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
    // Always clear these regardless of staleness below — if the user has since browsed to a
    // gallery item (bumping viewToken with no new generate() call to clean up after this one),
    // nothing else will ever clear this call's own progress-bar intervals, and they'd otherwise
    // tick forever in the background. stopLoadingAnimation() further down (which also snaps the
    // progress bar to 100%, a visible effect) stays gated behind the staleness check below, since
    // that visual change should only ever apply to whatever the user is currently looking at.
    clearInterval(progressTimer);
    clearInterval(messageTimer);
    if (myToken !== viewToken) return; // user has since browsed to a different view — result still saved above, just don't yank the display out from under them
    currentPrompt = prompt;
    currentUrl = finalUrl;
    resultImg.src = finalUrl;
    resultImg.alt = prompt;
    resultPrompt.textContent = `"${prompt}"`;
    stopLoadingAnimation(true);
    setTimeout(() => {
      resultLoading.classList.add('hidden');
      resultImg.classList.remove('hidden');
    }, 200);
    if (topText || bottomText) {
      if (captioned) {
        errorEl.classList.add('hidden');
      } else {
        errorEl.textContent = "Picture generated, but the captions couldn't be added this time — here's the plain picture instead.";
        errorEl.classList.remove('hidden');
      }
    }
  } catch {
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
    // Same unconditional interval cleanup as the success path above, for the same reason.
    clearInterval(progressTimer);
    clearInterval(messageTimer);
    if (myToken !== viewToken) return;
    stopLoadingAnimation(false);
    resultLoading.classList.add('hidden');
    // If a previous generation is still showing (this was a Regenerate attempt), keep it
    // visible instead of wiping it out over a failed retry — resultImg.src is untouched
    // since we only ever overwrite it on success, above.
    if (currentUrl) {
      resultImg.classList.remove('hidden');
    } else {
      resultCard.classList.add('hidden');
    }
    errorEl.textContent = 'Could not generate a picture — the free service may be busy. Try again in a moment.';
    errorEl.classList.remove('hidden');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const prompt = promptInput.value.trim();
  // Found by the AI Studio functional-correctness audit: the input's `required` attribute only
  // blocks a truly empty field — a whitespace-only value passes native validation, then silently
  // no-op'd here with nothing shown, so the Generate button just appeared to do nothing.
  if (!prompt) {
    errorEl.textContent = 'Type something to generate a picture of.';
    errorEl.classList.remove('hidden');
    return;
  }
  const topText = activeCategory.id === 'meme' ? memeTopInput.value.trim() : '';
  const bottomText = activeCategory.id === 'meme' ? memeBottomInput.value.trim() : '';
  generate(prompt, Math.floor(Math.random() * 2 ** 31), topText, bottomText);
});

regenerateBtn.addEventListener('click', () => {
  if (!currentPrompt) return;
  // Read the live caption inputs rather than the text captured at the last successful
  // generation — otherwise an edited-but-not-yet-submitted caption gets silently dropped.
  const topText = activeCategory.id === 'meme' ? memeTopInput.value.trim() : '';
  const bottomText = activeCategory.id === 'meme' ? memeBottomInput.value.trim() : '';
  generate(currentPrompt, Math.floor(Math.random() * 2 ** 31), topText, bottomText);
});

// --- 4 variations at once: same prompt/category, 4 different seeds, laid out as a pick-one
// grid — a better starting workflow than the old one-at-a-time "🎲 New version" roulette when
// you don't yet know which random seed will land well. ---
const variationsBtn = document.getElementById('variations-btn');
const variationsCard = document.getElementById('variations-card');
const variationsGrid = document.getElementById('variations-grid');
const variationsLoading = document.getElementById('variations-loading');

variationsBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    errorEl.textContent = 'Type something to generate pictures of.';
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');
  variationsBtn.disabled = true;
  generateBtn.disabled = true;
  variationsCard.classList.remove('hidden');
  variationsGrid.innerHTML = '';
  variationsLoading.classList.remove('hidden');
  variationsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const styledPrompt = `${prompt}${activeCategory.suffix}`;
  const seeds = Array.from({ length: 4 }, () => Math.floor(Math.random() * 2 ** 31));
  // Promise.allSettled, not Promise.all — one bad seed shouldn't fail the whole batch when the
  // other three came back fine; still show whatever succeeded.
  const results = await Promise.allSettled(
    seeds.map((seed) => {
      const url = buildImageUrl(styledPrompt, seed);
      return loadImage(url, false).then(() => url);
    })
  );
  variationsLoading.classList.add('hidden');

  const okUrls = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!okUrls.length) {
    variationsCard.classList.add('hidden');
    errorEl.textContent = 'Could not generate variations — the free service may be busy. Try again in a moment.';
    errorEl.classList.remove('hidden');
  } else {
    for (const url of okUrls) {
      const cell = document.createElement('div');
      cell.className = 'variation-item';
      const img = document.createElement('img');
      img.src = url;
      img.alt = prompt;
      img.loading = 'lazy';
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      const pickVariation = () => {
        viewToken++; // invalidate any still-in-flight generate(), same reasoning as gallery items
        currentPrompt = prompt;
        currentUrl = url;
        resultCard.classList.remove('hidden');
        resultLoading.classList.add('hidden');
        resultImg.classList.remove('hidden');
        resultImg.src = url;
        resultImg.alt = prompt;
        resultPrompt.textContent = `"${prompt}"`;
        addToGallery(url, prompt);
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      img.addEventListener('click', pickVariation);
      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickVariation(); }
      });
      cell.appendChild(img);
      variationsGrid.appendChild(cell);
    }
  }
  variationsBtn.disabled = false;
  generateBtn.disabled = false;
});

// --- Download (fetch-as-blob so it saves instead of just opening the image) ---
downloadBtn.addEventListener('click', async () => {
  if (!currentUrl) return;
  downloadBtn.disabled = true;
  try {
    const res = await fetch(currentUrl);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `valk-ai-${Date.now()}.jpg`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch {
    window.open(currentUrl, '_blank');
  } finally {
    downloadBtn.disabled = false;
  }
});

// --- Send to chat ---
sendChatBtn.addEventListener('click', async () => {
  if (!currentUrl || !roomCode || !myName) return;
  sendChatBtn.disabled = true;
  const original = sendChatBtn.textContent;
  try {
    const accountToken = localStorage.getItem('valk-account-token');
    const headers = { 'Content-Type': 'application/json' };
    if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
    const res = await fetch('/post-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: roomCode, name: myName, pin: roomPin, mediaUrl: currentUrl, prompt: currentPrompt }),
    });
    if (!res.ok) throw new Error();
    sendChatBtn.textContent = '✅ Sent!';
  } catch {
    sendChatBtn.textContent = '❌ Failed';
  } finally {
    setTimeout(() => {
      sendChatBtn.textContent = original;
      sendChatBtn.disabled = false;
    }, 1800);
  }
});

// --- Gallery (kept in localStorage, per-browser) ---
const GALLERY_KEY = 'valk-ai-gallery';
const GALLERY_LIMIT = 40;

function loadGallery() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
    // Only the JSON-parse failure was guarded before — a value that parses fine but isn't an
    // array (manual tampering, or a future format change) flowed straight through, and every
    // caller assumes an array (addToGallery's .filter(), renderGallery's for...of), throwing and
    // breaking generation/gallery rendering entirely rather than just losing the saved gallery.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGallery(items) {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
  } catch (err) {
    // Storage full or unavailable (e.g. Safari Private Browsing) — the picture itself still
    // generated fine, so don't let a gallery-persistence failure look like generation failed.
    console.error('Could not save AI Studio gallery:', err);
  }
}

// The gallery is entirely client-side (localStorage) with no server-side record at all — a
// captioned meme's uploaded composite (see loadAndMaybeComposite's own /upload call) only ever
// gets "claimed" server-side by actually posting it to a room. Without this, keeping one in the
// gallery without ever posting it would let the server's orphaned-upload sweep delete the file
// out from under it. Fire-and-forget: a failure here just means this item stays vulnerable to
// the sweep until the next claim attempt, not a user-visible error worth surfacing.
//
// Found by the AI Studio functional-correctness audit: on success, marks the matching gallery
// item `claimed: true` in localStorage — the page-load sweep below reads this to skip items
// already confirmed claimed, instead of re-firing one request per gallery item on every single
// page load regardless of whether it was already claimed. A gallery past the shared per-IP rate
// limit's own burst size (8 requests/6s, shared with /upload and /post-image) previously risked a
// spurious 429 on the user's very next legitimate action (a fresh generate, a Send to chat) —
// entirely self-inflicted by their own gallery size, not anything they just tried to do.
function claimUploadUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fetch('/claim-upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).then((res) => {
    if (!res.ok) return;
    const items = loadGallery();
    const item = items.find((it) => it.url === url);
    if (item && !item.claimed) { item.claimed = true; saveGallery(items); }
  }).catch(() => {});
}

function addToGallery(url, prompt) {
  const items = loadGallery().filter((item) => item.url !== url);
  items.unshift({ url, prompt, at: Date.now() });
  // Found by the AI Studio functional-correctness audit: every generation — including a "🎲 New
  // version" regenerate on the same prompt, not just a deliberate save — was auto-added here with
  // no separate save action anywhere in the UI, and the oldest item past GALLERY_LIMIT was evicted
  // with zero indication. From the user's side that reads as a picture they deliberately kept
  // simply vanishing at some later, unrelated moment. Not changing the auto-save-everything
  // behavior itself (a bigger product decision — the gallery's whole design intent per this app's
  // own history is "keep indefinitely," and plenty of users likely rely on every draft landing
  // there) — just making the eviction it can now cause visible instead of silent.
  if (items.length > GALLERY_LIMIT) {
    errorEl.textContent = `Your picture gallery is full (${GALLERY_LIMIT} max) — the oldest one was removed to make room for this one.`;
    errorEl.classList.remove('hidden');
  }
  saveGallery(items.slice(0, GALLERY_LIMIT));
  claimUploadUrl(url); // this one item is genuinely new — claim it right away, same as before
  renderGallery();
}

function renderGallery() {
  const items = loadGallery();
  gallerySection.classList.toggle('hidden', items.length === 0);
  galleryGrid.innerHTML = '';
  for (const item of items) {
    const cell = document.createElement('div');
    cell.className = 'gallery-item';

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.prompt;
    img.loading = 'lazy';
    // tabindex + role + Enter/Space handler — a plain <img> with only a click listener is
    // invisible to keyboard navigation; a keyboard-only user could Tab to the "Remove" button
    // next to it but never open the image itself.
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    const openGalleryItem = () => {
      viewToken++; // invalidate any still-in-flight generate() so it can't overwrite this view later
      currentPrompt = item.prompt;
      currentUrl = item.url;
      promptInput.value = item.prompt;
      resultCard.classList.remove('hidden');
      resultLoading.classList.add('hidden');
      resultImg.classList.remove('hidden');
      resultImg.src = item.url;
      resultImg.alt = item.prompt;
      resultPrompt.textContent = `"${item.prompt}"`;
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    img.addEventListener('click', openGalleryItem);
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGalleryItem(); }
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'gallery-remove';
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove from gallery');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveGallery(loadGallery().filter((g) => g.url !== item.url));
      renderGallery();
    });

    cell.append(img, removeBtn);
    galleryGrid.appendChild(cell);
  }
}

clearGalleryBtn.addEventListener('click', () => {
  // Found by the AI Studio functional-correctness audit: this wiped the entire gallery
  // immediately on click — no confirmation, no undo — while styled as a plain underlined text
  // link right next to the "Your pictures" heading, an easy misclick (especially on mobile) with
  // no safety net at all.
  const count = loadGallery().length;
  if (!count) return;
  if (!confirm(`Remove all ${count} picture${count === 1 ? '' : 's'} from your gallery? This can't be undone.`)) return;
  saveGallery([]);
  renderGallery();
});

renderGallery();
// A one-time retry sweep for the whole gallery, on page load only — not on every renderGallery()
// call (regenerating an image, removing an item, etc. all call renderGallery() far more often
// than that). Each item was already claimed the moment it was added (see addToGallery), so this
// only matters for the rare case where that original claim silently failed (e.g. offline at the
// time). Two layers against exceeding the shared per-IP rate limit (/post-image and /upload draw
// from the same 8-requests/6s bucket, so a burst here could spuriously 429 the user's very next
// legitimate action): only items not yet marked `claimed` are retried at all (see claimUploadUrl
// above — most items on a returning visit already are, so this is normally a no-op sweep), and
// whatever's left is staggered rather than fired all at once.
const GALLERY_CLAIM_SWEEP_STAGGER_MS = 700;
loadGallery().filter((item) => !item.claimed).forEach((item, i) => {
  setTimeout(() => claimUploadUrl(item.url), i * GALLERY_CLAIM_SWEEP_STAGGER_MS);
});

// --- Mode tabs (Pictures / Code / Ask AI) ---
const modeTabPicture = document.getElementById('mode-tab-picture');
const modeTabCode = document.getElementById('mode-tab-code');
const modeTabChat = document.getElementById('mode-tab-chat');
const pictureSection = document.getElementById('picture-section');
const codeSection = document.getElementById('code-section');
const chatSection = document.getElementById('chat-section');

function setMode(mode) {
  modeTabPicture.classList.toggle('active', mode === 'picture');
  modeTabCode.classList.toggle('active', mode === 'code');
  modeTabChat.classList.toggle('active', mode === 'chat');
  pictureSection.classList.toggle('hidden', mode !== 'picture');
  codeSection.classList.toggle('hidden', mode !== 'code');
  chatSection.classList.toggle('hidden', mode !== 'chat');
}
modeTabPicture.addEventListener('click', () => setMode('picture'));
modeTabCode.addEventListener('click', () => setMode('code'));
modeTabChat.addEventListener('click', () => setMode('chat'));

// --- Code generation (real Claude API, server-side — see POST /generate-code in server.js) ---
const codeForm = document.getElementById('code-form');
const codePromptInput = document.getElementById('code-prompt-input');
const codeGenerateBtn = document.getElementById('code-generate-btn');
const codeErrorEl = document.getElementById('code-error');
const codeResultCard = document.getElementById('code-result-card');
const codeLoading = document.getElementById('code-loading');
const codeExplanationEl = document.getElementById('code-explanation');
const codeBlockWrap = document.getElementById('code-block-wrap');
const codeOutputCode = document.getElementById('code-output-code');
const codeCopyBtn = document.getElementById('code-copy-btn');
const codeRegenerateBtn = document.getElementById('code-regenerate-btn');
const codeSendChatBtn = document.getElementById('code-send-chat-btn');

if (roomCode && myName) codeSendChatBtn.classList.remove('hidden');

let currentCodeExplanation = '';
let currentCodeLanguage = '';
let currentCodeBody = '';
let lastCodePrompt = '';

// Claude is asked for exactly one fenced code block; this pulls it (and its language tag) out of
// the response, keeping whatever's outside the fence as the plain-text explanation.
function parseCodeResponse(text) {
  const match = text.match(/```(\w*)\n?([\s\S]*?)```/);
  if (!match) return { explanation: text.trim(), language: '', code: '' };
  const explanation = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim();
  return { explanation, language: match[1] || '', code: match[2].replace(/\n$/, '') };
}

async function generateCode(prompt) {
  lastCodePrompt = prompt;
  codeErrorEl.classList.add('hidden');
  codeResultCard.classList.remove('hidden');
  codeLoading.classList.remove('hidden');
  codeBlockWrap.classList.add('hidden');
  codeExplanationEl.textContent = '';
  codeSendChatBtn.classList.add('hidden');
  if (roomCode && myName) codeSendChatBtn.classList.remove('hidden');
  codeGenerateBtn.disabled = true;
  codeRegenerateBtn.disabled = true;

  try {
    const res = await fetch('/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Code generation failed');

    const { explanation, language, code } = parseCodeResponse(data.text);
    currentCodeExplanation = explanation;
    currentCodeLanguage = language;
    currentCodeBody = code || data.text.trim();
    codeExplanationEl.textContent = currentCodeExplanation;
    codeOutputCode.textContent = currentCodeBody;
    codeOutputCode.className = language ? `language-${language}` : '';
    codeBlockWrap.classList.remove('hidden');
  } catch (err) {
    codeResultCard.classList.add('hidden');
    codeErrorEl.textContent = err.message === 'Code generation failed'
      ? 'Could not generate code — try again in a moment.'
      : err.message;
    codeErrorEl.classList.remove('hidden');
  } finally {
    codeLoading.classList.add('hidden');
    codeGenerateBtn.disabled = false;
    codeRegenerateBtn.disabled = false;
  }
}

codeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const prompt = codePromptInput.value.trim();
  if (!prompt) {
    codeErrorEl.textContent = 'Describe the code you want first.';
    codeErrorEl.classList.remove('hidden');
    return;
  }
  generateCode(prompt);
});

codeRegenerateBtn.addEventListener('click', () => {
  if (!lastCodePrompt) return;
  generateCode(lastCodePrompt);
});

codeCopyBtn.addEventListener('click', async () => {
  const original = codeCopyBtn.textContent;
  try {
    await navigator.clipboard.writeText(currentCodeBody);
    codeCopyBtn.textContent = '✅ Copied!';
  } catch {
    codeCopyBtn.textContent = '❌ Failed';
  } finally {
    setTimeout(() => { codeCopyBtn.textContent = original; }, 1500);
  }
});

codeSendChatBtn.addEventListener('click', async () => {
  if (!currentCodeBody || !roomCode || !myName) return;
  codeSendChatBtn.disabled = true;
  const original = codeSendChatBtn.textContent;
  // Reuses the chat's existing single-backtick code rendering (see FORMAT_RE/renderTextWithMentions
  // in app.js) rather than inventing new chat-side markup — a leading plain-text explanation line
  // plus one backtick-wrapped block (language tag on its own first line, same shape Claude's own
  // fenced blocks use) renders as a real multi-line code block there.
  const langLine = currentCodeLanguage ? `${currentCodeLanguage}\n` : '';
  const snippet = `${currentCodeExplanation ? currentCodeExplanation + '\n' : ''}\`${langLine}${currentCodeBody}\``;
  try {
    const accountToken = localStorage.getItem('valk-account-token');
    const headers = { 'Content-Type': 'application/json' };
    if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
    const res = await fetch('/post-code', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: roomCode, name: myName, pin: roomPin, snippet }),
    });
    if (!res.ok) throw new Error();
    codeSendChatBtn.textContent = '✅ Sent!';
  } catch {
    codeSendChatBtn.textContent = '❌ Failed';
  } finally {
    setTimeout(() => {
      codeSendChatBtn.textContent = original;
      codeSendChatBtn.disabled = false;
    }, 1800);
  }
});

// --- Ask AI: real multi-turn chat (real Claude API, server-side — see POST /chat-with-ai in
// server.js). Stateless server-side, same as /generate-code above: the client resends the whole
// conversation on every turn, so there's nothing to clean up if the tab is just closed. ---
const chatForm = document.getElementById('chat-form');
const chatPromptInput = document.getElementById('chat-prompt-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatMessagesEl = document.getElementById('chat-messages');
const chatErrorEl = document.getElementById('chat-error');
const chatClearBtn = document.getElementById('chat-clear-btn');
const chatSendRoomBtn = document.getElementById('chat-send-room-btn');

let chatHistory = []; // [{role: 'user'|'assistant', content}] — mirrors what the server expects
let lastAiReply = '';

function renderChatMessage(role, content) {
  const row = document.createElement('div');
  row.className = `chat-msg ${role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'}`;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = content;
  row.appendChild(bubble);
  chatMessagesEl.appendChild(row);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'chat-msg chat-msg-ai chat-typing';
  row.id = 'chat-typing-row';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  row.appendChild(bubble);
  chatMessagesEl.appendChild(row);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function hideTyping() {
  const row = document.getElementById('chat-typing-row');
  if (row) row.remove();
}

async function sendChatMessage(text) {
  chatErrorEl.classList.add('hidden');
  renderChatMessage('user', text);
  chatHistory.push({ role: 'user', content: text });
  chatPromptInput.value = '';
  chatPromptInput.focus();
  chatSendBtn.disabled = true;
  showTyping();
  try {
    const res = await fetch('/chat-with-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory }),
    });
    const data = await res.json().catch(() => ({}));
    hideTyping();
    if (!res.ok) throw new Error(data.error || 'The AI didn’t respond — try again in a moment.');
    chatHistory.push({ role: 'assistant', content: data.text });
    lastAiReply = data.text;
    renderChatMessage('assistant', data.text);
    if (roomCode && myName) chatSendRoomBtn.classList.remove('hidden');
  } catch (err) {
    hideTyping();
    chatErrorEl.textContent = err.message;
    chatErrorEl.classList.remove('hidden');
    // Chat is stateless server-side (see server.js's own comment on /chat-with-ai) — the
    // client's array is the only record of the conversation, so drop the turn that failed
    // rather than leaving it in history for a retry to silently duplicate.
    chatHistory.pop();
  } finally {
    chatSendBtn.disabled = false;
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatPromptInput.value.trim();
  if (!text) return;
  sendChatMessage(text);
});

chatClearBtn.addEventListener('click', () => {
  chatHistory = [];
  lastAiReply = '';
  chatMessagesEl.innerHTML = '';
  chatErrorEl.classList.add('hidden');
  chatSendRoomBtn.classList.add('hidden');
});

chatSendRoomBtn.addEventListener('click', async () => {
  if (!lastAiReply || !roomCode || !myName) return;
  chatSendRoomBtn.disabled = true;
  const original = chatSendRoomBtn.textContent;
  try {
    const accountToken = localStorage.getItem('valk-account-token');
    const headers = { 'Content-Type': 'application/json' };
    if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
    const res = await fetch('/post-ai-chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: roomCode, name: myName, pin: roomPin, text: lastAiReply }),
    });
    if (!res.ok) throw new Error();
    chatSendRoomBtn.textContent = '✅ Sent!';
  } catch {
    chatSendRoomBtn.textContent = '❌ Failed';
  } finally {
    setTimeout(() => {
      chatSendRoomBtn.textContent = original;
      chatSendRoomBtn.disabled = false;
    }, 1800);
  }
});
