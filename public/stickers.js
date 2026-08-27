// Curated local sticker pack — no external API/account, just static images
// served from public/images/stickers/.
const STICKERS = [
  { file: 'star.png', label: 'Star' },
  { file: 'heart.png', label: 'Heart' },
  { file: 'smile.png', label: 'Smile' },
  { file: 'sad.png', label: 'Sad' },
  { file: 'sun.png', label: 'Sun' },
  { file: 'cloud.png', label: 'Cloud' },
  { file: 'lightning.png', label: 'Lightning' },
  { file: 'snow.png', label: 'Snowflake' },
  { file: 'note.png', label: 'Music note' },
  { file: 'check.png', label: 'Check' },
  { file: 'cross.png', label: 'Cross' },
  { file: 'coffee.png', label: 'Coffee' },
  { file: 'plane.png', label: 'Plane' },
  { file: 'flag.png', label: 'Flag' },
  { file: 'umbrella.png', label: 'Umbrella' },
  { file: 'diamond.png', label: 'Diamond' },
  { file: 'club.png', label: 'Club' },
// Found by the sticker-picker correctness audit: this used to be a relative path with no leading
// slash — resolved against whatever page happened to load it, and even once absolute, the
// server's message handler only ever accepted a real /uploads/ URL for mediaUrl (a deliberate
// tracker-link hardening pass that predates this feature and never accounted for stickers), so
// every single sticker send was silently dropped server-side with zero error. Fixed here (a real
// absolute path) plus server-side (server.js now whitelists this exact set of paths) — both
// halves were needed, this alone wasn't enough on its own.
].map((s) => ({ ...s, url: `/images/stickers/${s.file}` }));
