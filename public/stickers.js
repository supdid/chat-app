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
].map((s) => ({ ...s, url: `images/stickers/${s.file}` }));
