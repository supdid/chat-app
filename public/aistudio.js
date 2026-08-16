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
  localStorage.setItem('valk-theme', next);
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
function buildImageUrl(prompt, seed) {
  const [width, height] = ratioSelect.value.split('x');
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}

// --- Meme text: classic bold white-with-black-outline captions, wrapped and
// auto-shrunk to fit, drawn onto a canvas copy of the generated background. ---
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
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
    const { url: finalUrl, captioned } = await loadAndMaybeComposite(bgUrl, topText, bottomText);
    addToGallery(finalUrl, prompt);
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
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
  if (!prompt) return;
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
    return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]');
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

function addToGallery(url, prompt) {
  const items = loadGallery().filter((item) => item.url !== url);
  items.unshift({ url, prompt, at: Date.now() });
  saveGallery(items.slice(0, GALLERY_LIMIT));
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
  saveGallery([]);
  renderGallery();
});

renderGallery();
