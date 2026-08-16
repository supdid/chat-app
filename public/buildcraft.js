// --- Build Craft: an archipelago voxel world with creative/survival, crafting, caves ---

// ---------- Block catalog ----------
const DYE_COLORS = [
  ['White', 0xf9fffe], ['Light Gray', 0x9d9d97], ['Gray', 0x474f52], ['Black', 0x1d1d21],
  ['Brown', 0x724728], ['Red', 0xb02e26], ['Orange', 0xf9801d], ['Yellow', 0xfed83d],
  ['Lime', 0x80c71f], ['Green', 0x5e7c16], ['Cyan', 0x169c9c], ['Light Blue', 0x3ab3da],
  ['Blue', 0x3c44aa], ['Purple', 0x8932b8], ['Magenta', 0xc74ebd], ['Pink', 0xf38baa],
];

const WOOD_TYPES = [
  { key: 'Oak', log: 0x6b4a2b, planks: 0xb58a4a, leaves: 0x3f9142 },
  { key: 'Spruce', log: 0x4a3826, planks: 0x7a5a36, leaves: 0x2f5233 },
  { key: 'Birch', log: 0xd9d3b8, planks: 0xe0c98a, leaves: 0x6fae4a },
  { key: 'Jungle', log: 0x5b3a1e, planks: 0xb98a4f, leaves: 0x319b3f },
  { key: 'Acacia', log: 0x6b4030, planks: 0xc76b3c, leaves: 0x6a9c3f },
  { key: 'Dark Oak', log: 0x3a2a1c, planks: 0x4f3a24, leaves: 0x2d4a26 },
];

function buildBlockTypes() {
  const list = [];
  const push = (category, entry) => list.push({ category, ...entry });

  [
    ['Grass', 0x5fbf4a], ['Dirt', 0x8a6a3d], ['Coarse Dirt', 0x7a5a3d], ['Podzol', 0x5b3a22],
    ['Stone', 0x9e9e9e], ['Cobblestone', 0x8c8c8c], ['Mossy Cobblestone', 0x7e8f6e],
    ['Andesite', 0xa3a5a5], ['Diorite', 0xe8e6e6], ['Granite', 0x9c5f52], ['Gravel', 0x8b8378],
    ['Clay', 0x9aa6ad], ['Ice', 0x9fd0e8], ['Snow Block', 0xf5f9fb], ['Obsidian', 0x14101d],
  ].forEach(([name, color]) => push('Natural', { name, color, opacity: name === 'Ice' ? 0.75 : undefined }));

  [
    ['Coal Ore', 0x4a4a4a], ['Iron Ore', 0xd8c3a5], ['Gold Ore', 0xcdae51], ['Diamond Ore', 0x8fe0da],
    ['Emerald Ore', 0x4ce085], ['Redstone Ore', 0xa13a2f], ['Lapis Ore', 0x3a5fcf],
  ].forEach(([name, color]) => push('Ores', { name, color }));

  [
    ['Sand', 0xe6d28a], ['Red Sand', 0xc65f2e], ['Sandstone', 0xd9c988],
    ['Red Sandstone', 0xb5602e], ['Cactus', 0x3f8f3f],
  ].forEach(([name, color]) => push('Desert', { name, color }));

  WOOD_TYPES.forEach((w) => {
    push('Wood', { name: `${w.key} Log`, color: w.log });
    push('Wood', { name: `${w.key} Planks`, color: w.planks });
    push('Wood', { name: `${w.key} Leaves`, color: w.leaves });
  });

  DYE_COLORS.forEach(([name, hex]) => push('Wool', { name: `${name} Wool`, color: hex }));
  DYE_COLORS.forEach(([name, hex]) => push('Concrete', { name: `${name} Concrete`, color: hex }));
  DYE_COLORS.forEach(([name, hex]) => push('Terracotta', { name: `${name} Terracotta`, color: hex }));
  DYE_COLORS.forEach(([name, hex]) => push('Stained Glass', { name: `${name} Stained Glass`, color: hex, opacity: 0.5 }));

  [
    ['Bricks', 0xa5493a], ['Stone Bricks', 0x8f8f8f], ['Mossy Stone Bricks', 0x7e8f6e],
    ['Cracked Stone Bricks', 0x7d7d7d], ['Smooth Stone', 0xcfcfcf], ['Polished Andesite', 0xa3a5a5],
    ['Polished Diorite', 0xe8e6e6], ['Polished Granite', 0x9c5f52], ['Quartz Block', 0xece6da],
    ['Prismarine', 0x6bab9e], ['Prismarine Bricks', 0x5c9c8c], ['Dark Prismarine', 0x33544a],
    ['Sea Lantern', 0xcde8e0], ['Bookshelf', 0x8a6a3d], ['Crafting Table', 0x8a5a34], ['Furnace', 0x6b6b6b],
  ].forEach(([name, color]) => push('Building', { name, color }));
  push('Building', { name: 'Glass', color: 0xdff3f8, opacity: 0.4 });

  [
    ['Pumpkin', 0xd97a1f], ["Jack o'Lantern", 0xe8901f], ['Melon', 0x86a63c],
    ['Hay Bale', 0xd1a637], ['Red Mushroom Block', 0xa6342e], ['Brown Mushroom Block', 0x8a6a4a],
  ].forEach(([name, color]) => push('Decorative', { name, color }));
  push('Decorative', { name: 'Bed', color: 0xb02e26 });
  push('Decorative', { name: 'Enchant Table', color: 0x1e3a5c });

  push('Farming', { name: 'Farmland', color: 0x5b3f22 });
  push('Farming', { name: 'Wheat Crop (Sprout)', color: 0x8fbf5a });
  push('Farming', { name: 'Wheat Crop (Growing)', color: 0x6a9c3f });
  push('Farming', { name: 'Wheat Crop (Ripe)', color: 0xdcb642 });

  push('Items', { name: 'Stick', color: 0xa9825a, item: true });
  push('Items', { name: 'Iron Ingot', color: 0xe4e4e4, item: true });
  push('Items', { name: 'Gold Ingot', color: 0xffd700, item: true });
  push('Items', { name: 'Wheat Seeds', color: 0x8fbf5a, item: true });
  push('Items', { name: 'Wheat', color: 0xdcb642, item: true });
  push('Items', { name: 'Fishing Rod', color: 0x8a6a3d, item: true });
  push('Items', { name: 'Raw Fish', color: 0x9fb8c9, item: true });
  push('Items', { name: 'Boat', color: 0x8a5a34, item: true });
  push('Items', { name: 'Emerald', color: 0x2ecc71, item: true });
  push('Items', { name: 'Minecart', color: 0x6b6b6b, item: true });
  push('Items', { name: 'Firework Rocket', color: 0xe74c3c, item: true });
  push('Decorative', { name: 'Claim Flag', color: 0xe74c3c });
  push('Decorative', { name: 'Rail', color: 0x8c8c6a });
  const TOOL_TIER_COLORS = { Wooden: 0xc9a06a, Stone: 0x9e9e9e, Iron: 0xd8d8d8, Gold: 0xffd700, Diamond: 0x6fe0da };
  Object.keys(TOOL_TIER_COLORS).forEach((tier) => {
    const color = TOOL_TIER_COLORS[tier];
    ['Pickaxe', 'Axe', 'Shovel', 'Sword', 'Hoe'].forEach((tool) => {
      push('Items', { name: `${tier} ${tool}`, color, item: true });
    });
    push('Items', { name: `${tier} Armor`, color, item: true });
  });

  return list;
}

const BLOCK_TYPES = buildBlockTypes();
const indexOf = (name) => BLOCK_TYPES.findIndex((b) => b.name === name);
const GRASS = indexOf('Grass');
const DIRT = indexOf('Dirt');
const STONE = indexOf('Stone');
const SAND = indexOf('Sand');
const SANDSTONE = indexOf('Sandstone');
const CACTUS = indexOf('Cactus');
const OAK_LOG = indexOf('Oak Log');
const OAK_LEAVES = indexOf('Oak Leaves');
const BIRCH_LOG = indexOf('Birch Log');
const BIRCH_LEAVES = indexOf('Birch Leaves');
const JUNGLE_LOG = indexOf('Jungle Log');
const JUNGLE_LEAVES = indexOf('Jungle Leaves');
const RED_MUSHROOM = indexOf('Red Mushroom Block');
const BROWN_MUSHROOM = indexOf('Brown Mushroom Block');
const FARMLAND = indexOf('Farmland');
const WHEAT_SPROUT = indexOf('Wheat Crop (Sprout)');
const WHEAT_GROWING = indexOf('Wheat Crop (Growing)');
const WHEAT_RIPE = indexOf('Wheat Crop (Ripe)');
const WHEAT_SEEDS = indexOf('Wheat Seeds');
const WHEAT_ITEM = indexOf('Wheat');
const CROP_STAGES = [WHEAT_SPROUT, WHEAT_GROWING, WHEAT_RIPE];
const CROP_STAGE_MS = 25000; // ~25s/stage -> ~50s for a full grow cycle, quick enough to pay off in one session
const HOE_TYPES = new Set(['Wooden Hoe', 'Stone Hoe', 'Iron Hoe', 'Gold Hoe', 'Diamond Hoe'].map(indexOf));
const FISHING_ROD = indexOf('Fishing Rod');
const RAW_FISH = indexOf('Raw Fish');
const BOAT_ITEM = indexOf('Boat');
const BOAT_SPEED = 6; // faster than swimming (3.5), slower than flight (9)
const RAIL = indexOf('Rail');
const MINECART_ITEM = indexOf('Minecart');
const MINECART_SPEED = 8; // fastest ground travel, but only usable where rail has actually been laid
const FIREWORK_ROCKET = indexOf('Firework Rocket');
const BED = indexOf('Bed');
const ENCHANT_TABLE = indexOf('Enchant Table');
const LAPIS_ORE = indexOf('Lapis Ore');
const CLAIM_FLAG = indexOf('Claim Flag');
const CLAIM_RADIUS = 8;
// Server-authoritative list (everyone's client gets the same claims from bc-init/bc-claim-added)
// so all players agree on boundaries, but enforcement itself happens client-side before ever
// sending a bc-block change — the same "trust the client" model already used for placing/breaking
// blocks generally, just gated on a shared fact instead of purely local state.
let bcClaims = [];

function isCellClaimedByOther(x, z) {
  return bcClaims.some((c) => c.owner !== mpPlayerName && Math.hypot(x - c.x, z - c.z) <= c.radius);
}

function blockColor(typeIndex) {
  return BLOCK_TYPES[typeIndex].color;
}

// ---------- Recipes ----------
const RECIPES = [];
WOOD_TYPES.forEach((w) => {
  RECIPES.push({ output: { name: `${w.key} Planks`, count: 4 }, inputs: [{ name: `${w.key} Log`, count: 1 }] });
  RECIPES.push({ output: { name: 'Stick', count: 4 }, inputs: [{ name: `${w.key} Planks`, count: 2 }] });
  RECIPES.push({ output: { name: 'Crafting Table', count: 1 }, inputs: [{ name: `${w.key} Planks`, count: 4 }] });
});
RECIPES.push({ output: { name: 'Furnace', count: 1 }, inputs: [{ name: 'Cobblestone', count: 8 }] });
RECIPES.push({ output: { name: 'Fishing Rod', count: 1 }, inputs: [{ name: 'Stick', count: 3 }] });
RECIPES.push({ output: { name: 'Boat', count: 1 }, inputs: [{ name: 'Oak Planks', count: 5 }] });
RECIPES.push({ output: { name: 'Bed', count: 1 }, inputs: [{ name: 'White Wool', count: 3 }, { name: 'Oak Planks', count: 3 }] });
RECIPES.push({ output: { name: 'Enchant Table', count: 1 }, inputs: [{ name: 'Bookshelf', count: 2 }, { name: 'Diamond Ore', count: 2 }, { name: 'Obsidian', count: 1 }] });
RECIPES.push({ output: { name: 'Claim Flag', count: 1 }, inputs: [{ name: 'Emerald', count: 2 }, { name: 'Gold Ingot', count: 2 }] });
RECIPES.push({ output: { name: 'Rail', count: 8 }, inputs: [{ name: 'Iron Ingot', count: 2 }, { name: 'Stick', count: 1 }] });
RECIPES.push({ output: { name: 'Minecart', count: 1 }, inputs: [{ name: 'Iron Ingot', count: 5 }] });
RECIPES.push({ output: { name: 'Firework Rocket', count: 3 }, inputs: [{ name: 'Gold Ingot', count: 1 }, { name: 'Emerald', count: 1 }, { name: 'Stick', count: 1 }] });

// Smelting recipes — Coal Ore doubles as furnace fuel since there's no separate furnace-adjacency check.
[
  { output: 'Iron Ingot', input: 'Iron Ore' },
  { output: 'Gold Ingot', input: 'Gold Ore' },
  { output: 'Glass', input: 'Sand' },
  { output: 'Stone', input: 'Cobblestone' },
  { output: 'Smooth Stone', input: 'Stone' },
  { output: 'Bricks', input: 'Clay' },
].forEach(({ output, input }) => {
  RECIPES.push({ output: { name: output, count: 1 }, inputs: [{ name: input, count: 1 }, { name: 'Coal Ore', count: 1 }] });
});

// Building materials cut/pressed from raw blocks.
[
  { output: 'Sandstone', input: 'Sand' },
  { output: 'Stone Bricks', input: 'Stone' },
  { output: 'Polished Andesite', input: 'Andesite' },
  { output: 'Polished Diorite', input: 'Diorite' },
  { output: 'Polished Granite', input: 'Granite' },
].forEach(({ output, input }) => {
  RECIPES.push({ output: { name: output, count: 4 }, inputs: [{ name: input, count: 4 }] });
});

const TOOL_MATERIAL_COUNT = { Pickaxe: 3, Axe: 3, Shovel: 1, Sword: 2, Hoe: 2 };
const TOOL_STICK_COUNT = { Pickaxe: 2, Axe: 2, Shovel: 2, Sword: 1, Hoe: 2 };
const TOOL_TIERS = [
  ['Wooden', 'Oak Planks'],
  ['Stone', 'Cobblestone'],
  ['Iron', 'Iron Ingot'],
  ['Gold', 'Gold Ingot'],
  ['Diamond', 'Diamond Ore'],
];
TOOL_TIERS.forEach(([tier, material]) => {
  Object.keys(TOOL_MATERIAL_COUNT).forEach((tool) => {
    RECIPES.push({
      output: { name: `${tier} ${tool}`, count: 1 },
      inputs: [
        { name: material, count: TOOL_MATERIAL_COUNT[tool] },
        { name: 'Stick', count: TOOL_STICK_COUNT[tool] },
      ],
    });
  });
});
TOOL_TIERS.forEach(([tier, material]) => {
  RECIPES.push({ output: { name: `${tier} Armor`, count: 1 }, inputs: [{ name: material, count: 6 }] });
});
RECIPES.forEach((r) => {
  r.output.typeIndex = indexOf(r.output.name);
  r.inputs.forEach((inp) => { inp.typeIndex = indexOf(inp.name); });
});

const REACH = 10;
const FLY_SPEED = 9;
const WALK_SPEED = 5.5;
const SWIM_SPEED = 3.5;
const SWIM_VERTICAL_SPEED = 3;
const JUMP_SPEED = 7.5;
const GRAVITY = -22;
const EYE_HEIGHT = 1.6;
const WATER_LEVEL = 0;
const LOOK_SENSITIVITY = 0.0022;
const BREAK_INTERVAL = 260;
const PLACE_INTERVAL = 220;
const PICKUP_RADIUS = 1.3;

let gameMode = 'creative'; // 'creative' | 'survival'
let gameStarted = false;
let inventoryOpen = false;
let craftingOpen = false;
let selectedSlot = 0;
let verticalVelocity = 0;
const hotbar = Array.from({ length: 9 }, () => ({ typeIndex: null }));
const survivalInventory = new Map(); // typeIndex -> count

// ---------- Rendering: instanced blocks ----------
const world = new Map(); // "x,y,z" -> block type index
const cellInstance = new Map(); // "x,y,z" -> { typeIndex, index }
const materialCache = new Map(); // type index -> material
const instancedMeshes = new Map(); // type index -> THREE.InstancedMesh
const instanceCapacity = new Map();
const instanceCount = new Map();
const freeList = new Map(); // type index -> array of free instance indices
const dummy = new THREE.Object3D();

function keyOf(x, y, z) { return `${x},${y},${z}`; }

// ---------- Procedural pixel-art block textures (Minecraft-style, no external assets) ----------
const TEXTURE_SIZE = 16;
function hexToRgb(hex) { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; }
function clamp255(v) { return Math.max(0, Math.min(255, v)); }
function shadeRgb([r, g, b], amt) { return [clamp255(r + amt), clamp255(g + amt), clamp255(b + amt)]; }
function rgbCss(rgb) { return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; }
function newCanvas() {
  const c = document.createElement('canvas');
  c.width = TEXTURE_SIZE;
  c.height = TEXTURE_SIZE;
  return c;
}

function speckleTexture(baseColor, noise = 16) {
  const canvas = newCanvas();
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColor);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      ctx.fillStyle = rgbCss(shadeRgb(rgb, (Math.random() - 0.5) * 2 * noise));
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function plankTexture(baseColor) {
  const canvas = speckleTexture(baseColor, 10);
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColor);
  ctx.fillStyle = rgbCss(shadeRgb(rgb, -35));
  for (let y = 3; y < TEXTURE_SIZE; y += 4) ctx.fillRect(0, y, TEXTURE_SIZE, 1);
  ctx.fillStyle = rgbCss(shadeRgb(rgb, -18));
  for (let x = 0; x < TEXTURE_SIZE; x += 7) ctx.fillRect(x, 0, 1, TEXTURE_SIZE);
  return canvas;
}

function logTexture(baseColor) {
  const canvas = speckleTexture(baseColor, 10);
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColor);
  ctx.fillStyle = rgbCss(shadeRgb(rgb, -30));
  for (let x = 1; x < TEXTURE_SIZE; x += 3) ctx.fillRect(x, 0, 1, TEXTURE_SIZE);
  return canvas;
}

function oreTexture(baseColor) {
  const canvas = speckleTexture(0x9e9e9e, 14); // stone base, matches the surrounding rock
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColor);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      if (Math.random() < 0.16) {
        ctx.fillStyle = rgbCss(shadeRgb(rgb, (Math.random() - 0.5) * 20));
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

function brickTexture(baseColor) {
  const canvas = newCanvas();
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColor);
  ctx.fillStyle = rgbCss(shadeRgb(rgb, -70));
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const rowH = 4;
  for (let row = 0; row < TEXTURE_SIZE / rowH; row++) {
    const offset = row % 2 === 0 ? 0 : 4;
    for (let bx = -4; bx < TEXTURE_SIZE; bx += 8) {
      ctx.fillStyle = rgbCss(shadeRgb(rgb, (Math.random() - 0.5) * 16));
      ctx.fillRect(bx + offset + 1, row * rowH + 1, 6, rowH - 1);
    }
  }
  return canvas;
}

function glassTexture(baseColor) {
  const canvas = newCanvas();
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColor);
  ctx.fillStyle = rgbCss(shadeRgb(rgb, 10));
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  ctx.fillStyle = rgbCss(shadeRgb(rgb, -60));
  ctx.fillRect(0, 0, TEXTURE_SIZE, 1);
  ctx.fillRect(0, TEXTURE_SIZE - 1, TEXTURE_SIZE, 1);
  ctx.fillRect(0, 0, 1, TEXTURE_SIZE);
  ctx.fillRect(TEXTURE_SIZE - 1, 0, 1, TEXTURE_SIZE);
  return canvas;
}

// ---------- Item slot icons (UI): sticks/ingots/tools get a silhouette instead of a flat color swatch ----------
const ICON_SIZE = 40;
function newIconCanvas() {
  const c = document.createElement('canvas');
  c.width = ICON_SIZE;
  c.height = ICON_SIZE;
  return c;
}

function drawStickIcon(ctx, color) {
  ctx.save();
  ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = rgbCss(hexToRgb(color));
  ctx.fillRect(-4, -16, 8, 32);
  ctx.fillStyle = rgbCss(shadeRgb(hexToRgb(color), -30));
  ctx.fillRect(-4, -16, 8, 4);
  ctx.restore();
}

function drawIngotIcon(ctx, color) {
  ctx.save();
  ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
  ctx.fillStyle = rgbCss(hexToRgb(color));
  ctx.fillRect(-13, -6, 26, 12);
  ctx.fillStyle = rgbCss(shadeRgb(hexToRgb(color), 40));
  ctx.fillRect(-13, -6, 26, 3);
  ctx.restore();
}

function drawToolIcon(ctx, tool, color) {
  ctx.save();
  ctx.translate(ICON_SIZE / 2, ICON_SIZE / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = rgbCss(hexToRgb(0xa9825a));
  ctx.fillRect(-3, -6, 6, 22);
  ctx.fillStyle = rgbCss(hexToRgb(color));
  if (tool === 'Pickaxe') {
    ctx.save(); ctx.translate(0, -12); ctx.rotate(0.5); ctx.fillRect(-11, -3, 22, 6); ctx.restore();
    ctx.save(); ctx.translate(0, -12); ctx.rotate(-0.5); ctx.fillRect(-11, -3, 22, 6); ctx.restore();
  } else if (tool === 'Axe') {
    ctx.fillRect(0, -18, 12, 12);
  } else if (tool === 'Shovel') {
    ctx.fillRect(-5, -18, 10, 8);
  } else if (tool === 'Sword') {
    ctx.fillRect(-3, -22, 6, 18);
    ctx.fillRect(-9, -8, 18, 4);
  } else if (tool === 'Hoe') {
    ctx.fillRect(0, -16, 13, 5);
  }
  ctx.restore();
}

const itemIconCache = new Map();
function itemIconUrl(typeIndex) {
  if (itemIconCache.has(typeIndex)) return itemIconCache.get(typeIndex);
  const type = BLOCK_TYPES[typeIndex];
  const canvas = newIconCanvas();
  const ctx = canvas.getContext('2d');
  if (type.name === 'Stick') drawStickIcon(ctx, type.color);
  else if (type.name.endsWith('Ingot')) drawIngotIcon(ctx, type.color);
  else drawToolIcon(ctx, type.name.split(' ')[1], type.color);
  const url = canvas.toDataURL();
  itemIconCache.set(typeIndex, url);
  return url;
}

// Applies either a flat color (blocks) or a silhouette icon (items) to a swatch element.
function styleSwatchFor(el, typeIndex) {
  const type = BLOCK_TYPES[typeIndex];
  if (type.item) {
    el.style.background = 'rgba(255, 255, 255, 0.05)';
    el.style.backgroundImage = `url(${itemIconUrl(typeIndex)})`;
    el.style.backgroundSize = '75%';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
  } else {
    el.style.background = `#${blockColor(typeIndex).toString(16).padStart(6, '0')}`;
    el.style.backgroundImage = 'none';
  }
}

function textureForType(typeIndex) {
  const type = BLOCK_TYPES[typeIndex];
  const name = type.name;
  if (name === 'Bricks') return brickTexture(type.color);
  if (name.endsWith('Log')) return logTexture(type.color);
  if (name.endsWith('Planks') || name === 'Hay Bale' || name === 'Crafting Table' || name === 'Bookshelf') return plankTexture(type.color);
  if (name.endsWith('Leaves')) return speckleTexture(type.color, 22);
  if (name.endsWith('Stained Glass') || name === 'Glass') return glassTexture(type.color);
  if (type.category === 'Ores') return oreTexture(type.color);
  return speckleTexture(type.color, 16);
}

const textureCache = new Map();
function materialFor(typeIndex) {
  if (materialCache.has(typeIndex)) return materialCache.get(typeIndex);
  const type = BLOCK_TYPES[typeIndex];
  let texture = textureCache.get(typeIndex);
  if (!texture) {
    texture = new THREE.CanvasTexture(textureForType(typeIndex));
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    textureCache.set(typeIndex, texture);
  }
  const base = {
    map: texture,
    transparent: type.opacity !== undefined,
    opacity: type.opacity !== undefined ? type.opacity : 1,
  };
  // Fixed per-face tint approximates Minecraft's classic top-bright / side-medium / bottom-dark shading.
  const side = new THREE.MeshLambertMaterial({ ...base, color: 0xcfcfcf });
  const top = new THREE.MeshLambertMaterial({ ...base, color: 0xffffff });
  const bottom = new THREE.MeshLambertMaterial({ ...base, color: 0x8a8a8a });
  const mat = [side, side, top, bottom, side, side];
  materialCache.set(typeIndex, mat);
  return mat;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8e3);
// Islands only ever cluster within ~130-150 units of the fixed spawn point (0,4,0) — pushed
// this way out (near camera's own far=700 clip) so a freshly-joined player can see every
// island/build from spawn without fog hiding anything; still fades near the very edge for a
// natural horizon instead of a hard pop.
scene.fog = new THREE.Fog(0x7ec8e3, 400, 690);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 700);
const pitchObject = new THREE.Object3D();
pitchObject.add(camera);
const yawObject = new THREE.Object3D();
yawObject.position.set(0, 4, 0);
yawObject.add(pitchObject);
scene.add(yawObject);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hemiLight = new THREE.HemisphereLight(0xbfe3ff, 0x3a6b3a, 1.0);
scene.add(hemiLight);
const sun = new THREE.DirectionalLight(0xfff2d0, 0.95);
sun.position.set(30, 50, 20);
scene.add(sun);

// A visible glowing sun, positioned along the same direction as the light source above.
const sunMesh = new THREE.Mesh(
  new THREE.BoxGeometry(40, 40, 40),
  new THREE.MeshBasicMaterial({ color: 0xfff9e0, fog: false })
);
sunMesh.position.set(150, 400, 250);
scene.add(sunMesh);

// ---------- Day/night cycle ----------
// Driven entirely by wall-clock time (Date.now()) rather than a server message or local timer
// state — every client computes the same phase independently, so the whole room's sky/lighting
// stays in sync "for free" without any networking.
const moonLight = new THREE.DirectionalLight(0xc7d6ff, 0);
scene.add(moonLight);
const moonMesh = new THREE.Mesh(
  new THREE.BoxGeometry(28, 28, 28),
  new THREE.MeshBasicMaterial({ color: 0xdfe6f5, fog: false })
);
scene.add(moonMesh);

// ---------- Stars ----------
// Nothing but the moon occupied the night sky before this, so the small hours read as a flat dark
// background. Positions are plain Math.random(), not the seeded world PRNG — same rule the world
// generator follows, where only layout-affecting randomness has to match between clients.
const STAR_COUNT = 700;
const STAR_SHELL = 620; // inside camera.far (700); fog is off for these
const starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  // Upper hemisphere only. The islands float in open air, so stars placed below the horizon would
  // be plainly visible underfoot and read as fireflies rather than sky.
  const theta = Math.random() * Math.PI * 2;
  const y = 0.08 + Math.random() * 0.92;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  starPositions[i * 3] = Math.cos(theta) * r * STAR_SHELL;
  starPositions[i * 3 + 1] = y * STAR_SHELL;
  starPositions[i * 3 + 2] = Math.sin(theta) * r * STAR_SHELL;
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
// sizeAttenuation off so a star is a fixed pixel size rather than shrinking with the shell radius.
const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff, size: 2.4, sizeAttenuation: false,
  transparent: true, opacity: 0, depthWrite: false, fog: false,
});
const starField = new THREE.Points(starGeometry, starMaterial);
starField.frustumCulled = false;
starField.visible = false;
scene.add(starField);

// ---------- Sun / moon halo ----------
// Both bodies are plain emissive boxes, which reads as a sticker pasted on the sky — most obvious
// at dawn and dusk, which this world passes through every 20 minutes. Additive sprites behind them
// give the light somewhere to fall off to.
function makeSkyGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const skyGlowTexture = makeSkyGlowTexture();

function makeSkyGlow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: skyGlowTexture, color, transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  s.scale.set(size, size, 1);
  scene.add(s);
  return s;
}
const sunGlow = makeSkyGlow(0xffd9a0, 190);
const moonGlow = makeSkyGlow(0xbcd0ff, 110);

const DAY_CYCLE_MS = 20 * 60 * 1000; // one full day/night every 20 real minutes
const SKY_ORBIT_RADIUS = 400;
const DAY_SKY_COLOR = new THREE.Color(0x7ec8e3);
const NIGHT_SKY_COLOR = new THREE.Color(0x050b16);
const skyColorScratch = new THREE.Color();
// Shifts the wall-clock time the day/night (and weather) calc is based on — 0 until someone
// sleeps through a night, then jumped forward by however many ms are needed to reach morning.
// Solo mode manages this purely locally; multiplayer gets it from the server via bc-skip-night
// so every client's sky stays in sync.
let dayNightOffsetMs = 0;

function updateDayNightCycle() {
  const phase = ((Date.now() + dayNightOffsetMs) % DAY_CYCLE_MS) / DAY_CYCLE_MS; // 0 = midnight, 0.5 = noon
  const angle = phase * Math.PI * 2 - Math.PI / 2;
  const sunHeight = Math.sin(angle);

  sun.position.set(Math.cos(angle) * SKY_ORBIT_RADIUS, sunHeight * SKY_ORBIT_RADIUS, 250);
  sunMesh.position.copy(sun.position).multiplyScalar(1.5);
  sunMesh.visible = sunHeight > -0.08;

  const moonAngle = angle + Math.PI;
  const moonHeight = Math.sin(moonAngle);
  moonLight.position.set(Math.cos(moonAngle) * SKY_ORBIT_RADIUS, moonHeight * SKY_ORBIT_RADIUS, 250);
  moonMesh.position.copy(moonLight.position).multiplyScalar(1.5);
  moonMesh.visible = moonHeight > -0.08;

  const dayStrength = Math.max(0, sunHeight);
  sun.intensity = dayStrength * 0.95;
  moonLight.intensity = Math.max(0, moonHeight) * 0.18;
  hemiLight.intensity = 0.35 + dayStrength * 0.65;

  // Haloes ride on the bodies themselves, so they inherit the same visibility cutoff at the horizon.
  sunGlow.position.copy(sunMesh.position);
  sunGlow.visible = sunMesh.visible;
  moonGlow.position.copy(moonMesh.position);
  moonGlow.visible = moonMesh.visible;

  // Stars fade in once the sun is genuinely below the horizon, and stay mostly hidden under cloud
  // when it's raining. Recentred on the player every frame so the shell behaves as a skybox — at
  // 620 units a fixed field would visibly parallax across a world only ~150 units wide.
  let starAlpha = Math.max(0, Math.min(1, (0.12 - sunHeight) * 3.2));
  if (isRaining) starAlpha *= 0.2;
  starMaterial.opacity = starAlpha;
  starField.visible = starAlpha > 0.01;
  starField.position.copy(yawObject.position);

  skyColorScratch.copy(NIGHT_SKY_COLOR).lerp(DAY_SKY_COLOR, dayStrength);
  applyWeatherTint(skyColorScratch);
  scene.background = skyColorScratch;
  scene.fog.color.copy(skyColorScratch);
}

// ---------- Weather ----------
// Same "derive it from wall-clock time" trick as the day/night cycle — a deterministic PRNG
// seeded by the current weather window means every client decides "is it raining" identically
// without the server ever having to broadcast weather state.
const WEATHER_WINDOW_MS = 8 * 60 * 1000;
const RAIN_CHANCE = 0.3;
const RAIN_TINT = new THREE.Color(0x4a5a66);
let isRaining = false;
let lastWeatherWindow = -1;

const RAIN_COUNT = 400;
const RAIN_VOLUME = 70; // rain particles live in a box this size, centered under the camera
const rainGeometry = new THREE.BufferGeometry();
const rainPositions = new Float32Array(RAIN_COUNT * 3);
for (let i = 0; i < RAIN_COUNT; i++) {
  rainPositions[i * 3] = (Math.random() - 0.5) * RAIN_VOLUME;
  rainPositions[i * 3 + 1] = Math.random() * RAIN_VOLUME;
  rainPositions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_VOLUME;
}
rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMaterial = new THREE.PointsMaterial({ color: 0xaecbe8, size: 0.15, transparent: true, opacity: 0.6 });
const rainPoints = new THREE.Points(rainGeometry, rainMaterial);
rainPoints.visible = false;
rainPoints.frustumCulled = false;
scene.add(rainPoints);

function applyWeatherTint(color) {
  if (isRaining) color.lerp(RAIN_TINT, 0.45);
}

function updateWeather(delta) {
  const windowIndex = Math.floor((Date.now() + dayNightOffsetMs) / WEATHER_WINDOW_MS);
  if (windowIndex !== lastWeatherWindow) {
    lastWeatherWindow = windowIndex;
    isRaining = mulberry32(windowIndex)() < RAIN_CHANCE;
    rainPoints.visible = isRaining;
    scene.fog.near = isRaining ? 160 : 400;
  }
  if (!isRaining) return;
  rainPoints.position.set(yawObject.position.x, 0, yawObject.position.z);
  const pos = rainGeometry.attributes.position;
  for (let i = 0; i < RAIN_COUNT; i++) {
    let y = pos.getY(i) - delta * 28;
    if (y < -2) y += RAIN_VOLUME;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}

// Blocky Minecraft-style clouds, slowly drifting.
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
const clouds = [];
for (let i = 0; i < 16; i++) {
  const group = new THREE.Group();
  const blockCount = 3 + Math.floor(Math.random() * 4);
  for (let b = 0; b < blockCount; b++) {
    const mesh = new THREE.Mesh(cloudGeo, cloudMat);
    mesh.scale.set(6 + Math.random() * 6, 2.5, 5 + Math.random() * 6);
    mesh.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 12);
    group.add(mesh);
  }
  group.position.set((Math.random() - 0.5) * 500, 75 + Math.random() * 20, (Math.random() - 0.5) * 500);
  group.userData.driftSpeed = 0.4 + Math.random() * 0.6;
  scene.add(group);
  clouds.push(group);
}
function updateClouds(delta) {
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.driftSpeed * delta;
    if (cloud.position.x > 300) cloud.position.x = -300;
  }
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function createInstancedMesh(typeIndex, capacity) {
  const mesh = new THREE.InstancedMesh(boxGeo, materialFor(typeIndex), capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  instancedMeshes.set(typeIndex, mesh);
  instanceCapacity.set(typeIndex, capacity);
  instanceCount.set(typeIndex, 0);
  freeList.set(typeIndex, []);
  return mesh;
}

function growCapacity(typeIndex) {
  const oldMesh = instancedMeshes.get(typeIndex);
  const oldCapacity = instanceCapacity.get(typeIndex);
  const newCapacity = Math.max(64, oldCapacity * 2);
  const newMesh = new THREE.InstancedMesh(boxGeo, materialFor(typeIndex), newCapacity);
  newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  newMesh.frustumCulled = false;
  newMesh.instanceMatrix.array.set(oldMesh.instanceMatrix.array);
  newMesh.count = oldMesh.count;
  scene.remove(oldMesh);
  scene.add(newMesh);
  instancedMeshes.set(typeIndex, newMesh);
  instanceCapacity.set(typeIndex, newCapacity);
  return newMesh;
}

function addBlock(x, y, z, typeIndex) {
  const key = keyOf(x, y, z);
  if (world.has(key)) return;
  let mesh = instancedMeshes.get(typeIndex);
  if (!mesh) mesh = createInstancedMesh(typeIndex, 64);
  const free = freeList.get(typeIndex);
  let idx;
  if (free.length > 0) {
    idx = free.pop();
  } else {
    idx = instanceCount.get(typeIndex);
    if (idx >= instanceCapacity.get(typeIndex)) mesh = growCapacity(typeIndex);
    instanceCount.set(typeIndex, idx + 1);
    mesh.count = idx + 1;
  }
  dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(idx, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
  world.set(key, typeIndex);
  cellInstance.set(key, { typeIndex, index: idx });
}

function removeBlockAt(x, y, z) {
  const key = keyOf(x, y, z);
  const info = cellInstance.get(key);
  if (!info) return null;
  const mesh = instancedMeshes.get(info.typeIndex);
  dummy.position.set(0, -10000, 0);
  dummy.scale.set(0.0001, 0.0001, 0.0001);
  dummy.updateMatrix();
  mesh.setMatrixAt(info.index, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
  freeList.get(info.typeIndex).push(info.index);
  cellInstance.delete(key);
  world.delete(key);
  return info.typeIndex;
}

// ---------- Archipelago world generation ----------
const SPAWN_R = 5;
const DEPTH = 14;
const SUB_LAYERS = 2;
const ORE_TABLE = [
  [indexOf('Coal Ore'), 0.04], [indexOf('Iron Ore'), 0.02], [indexOf('Gold Ore'), 0.01],
  [indexOf('Diamond Ore'), 0.005], [indexOf('Emerald Ore'), 0.005],
  [indexOf('Redstone Ore'), 0.01], [indexOf('Lapis Ore'), 0.01],
];

// Seeded PRNG (mulberry32) so multiplayer clients given the same seed generate an identical base
// world. Only layout-affecting randomness uses this — purely cosmetic randomness (cloud shapes,
// break-particle velocity, texture speckle noise) is left on Math.random() since it never needs to
// match between clients.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = Math.random;

function stoneOrOre() {
  const roll = rng();
  let acc = 0;
  for (const [typeIdx, chance] of ORE_TABLE) {
    acc += chance;
    if (roll < acc) return typeIdx;
  }
  return STONE;
}

function biomeAt(x, z, isl) {
  const angle = ((Math.atan2(z - isl.cz, x - isl.cx) * 180) / Math.PI + 360) % 360;
  if (angle < 90) return 'desert';
  if (angle < 180) return 'jungle';
  if (angle < 270) return 'oak';
  return 'birch';
}

function placeTree(x, z, logType, leavesType, minHeight, maxHeight, canopy) {
  const height = minHeight + Math.floor(rng() * (maxHeight - minHeight + 1));
  for (let y = 1; y <= height; y++) addBlock(x, y, z, logType);
  for (let dx = -canopy; dx <= canopy; dx++) {
    for (let dz = -canopy; dz <= canopy; dz++) addBlock(x + dx, height + 1, z + dz, leavesType);
  }
  addBlock(x, height + 2, z, leavesType);
}

function placeCactus(x, z) {
  const height = 1 + Math.floor(rng() * 3);
  for (let y = 1; y <= height; y++) addBlock(x, y, z, CACTUS);
}

function scatterDecoration(x, z, biome) {
  const roll = rng();
  if (biome === 'desert' && roll < 0.06) placeCactus(x, z);
  else if (biome === 'jungle') {
    if (roll < 0.18) placeTree(x, z, JUNGLE_LOG, JUNGLE_LEAVES, 5, 6, 2);
    else if (roll < 0.22) addBlock(x, 1, z, rng() < 0.5 ? RED_MUSHROOM : BROWN_MUSHROOM);
  } else if (biome === 'oak' && roll < 0.12) placeTree(x, z, OAK_LOG, OAK_LEAVES, 3, 4, 1);
  else if (biome === 'birch' && roll < 0.12) placeTree(x, z, BIRCH_LOG, BIRCH_LEAVES, 4, 5, 1);
}

const ISLANDS = [{ cx: 0, cz: 0, landR: 26, beachR: 29 }];

// Mob state/tuning — declared here (not down with the rest of the mob code) because
// generateWorld() calls spawnMobs() synchronously in solo mode, before the script has finished
// its first top-to-bottom pass; a const declared further down would still be in its temporal
// dead zone at that point and throw. Spawn positions come from ISLANDS (seeded, so every client
// starts with mobs in the same spots); movement/AI after that is purely client-local — not
// networked, so this is deliberately "ambient danger" rather than a synced multiplayer mob.
const MOB_MAX_COUNT = 8;
const MOB_HEALTH = 2;
const MOB_DAMAGE = 1;
const MOB_DAMAGE_COOLDOWN_MS = 900;
const MOB_DETECT_RANGE = 11;
const MOB_CHASE_SPEED = 2.2;
const MOB_WANDER_SPEED = 0.7;
const mobs = [];
// Villagers are also spawned synchronously from generateWorld() (same TDZ reasoning as mobs
// above), passive and client-local, not synced across multiplayer clients.
const VILLAGER_MAX_COUNT = 3;
const VILLAGER_WANDER_SPEED = 0.4;
const villagers = [];
// Horses: same client-local ambient spawn as mobs/villagers. Wild until tamed (a random-chance
// interaction, same idea as vanilla Minecraft), then rideable — faster than walking, works on
// any land instead of being constrained to water/rails like boats/minecarts.
const HORSE_MAX_COUNT = 4;
const HORSE_WANDER_SPEED = 0.6;
const HORSE_SPEED = 7;
const HORSE_TAME_CHANCE = 0.35;
const horses = [];
let ridingHorse = false;
let mountedHorse = null;
let horseMesh = null;
function tryPlaceIsland(landR) {
  const beachR = landR + 3;
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = 55 + rng() * 50;
    const cx = Math.round(Math.cos(angle) * dist);
    const cz = Math.round(Math.sin(angle) * dist);
    const tooClose = ISLANDS.some((isl) => {
      const dx = cx - isl.cx, dz = cz - isl.cz;
      const minSep = isl.beachR + beachR + 8;
      return dx * dx + dz * dz < minSep * minSep;
    });
    if (!tooClose) {
      ISLANDS.push({ cx, cz, landR, beachR });
      return;
    }
  }
}

function generateIsland(isl) {
  const { cx, cz, landR, beachR } = isl;
  for (let x = cx - beachR; x <= cx + beachR; x++) {
    for (let z = cz - beachR; z <= cz + beachR; z++) {
      const dx = x - cx, dz = z - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > beachR) continue;
      const isBeach = dist > landR;
      const isSpawnClearing = isl === ISLANDS[0] && dist <= SPAWN_R;
      const biome = isBeach ? 'beach' : (isSpawnClearing ? 'plains' : biomeAt(x, z, isl));

      let topType, subType;
      if (biome === 'beach') { topType = SAND; subType = SAND; }
      else if (biome === 'desert') { topType = SAND; subType = SANDSTONE; }
      else { topType = GRASS; subType = DIRT; }

      const depth = isBeach ? 6 : DEPTH;
      addBlock(x, 0, z, topType);
      for (let d = 1; d <= depth - 1; d++) {
        const y = -d;
        const type = d <= SUB_LAYERS ? subType : (isBeach ? SAND : stoneOrOre());
        addBlock(x, y, z, type);
      }

      if (!isBeach && !isSpawnClearing && ((x - cx) % 3 === 0) && ((z - cz) % 3 === 0)) {
        const jx = x + Math.floor(rng() * 3) - 1;
        const jz = z + Math.floor(rng() * 3) - 1;
        const jdx = jx - cx, jdz = jz - cz;
        if (jdx * jdx + jdz * jdz < landR * landR) scatterDecoration(jx, jz, biomeAt(jx, jz, isl));
      }
    }
  }
}

const waterTextureCanvas = newCanvas();
{
  const ctx = waterTextureCanvas.getContext('2d');
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const shade = 0.55 + 0.25 * Math.sin(x * 0.9 + y * 0.4) + Math.random() * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, shade)).toFixed(2)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
const waterTexture = new THREE.CanvasTexture(waterTextureCanvas);
waterTexture.wrapS = THREE.RepeatWrapping;
waterTexture.wrapT = THREE.RepeatWrapping;
waterTexture.magFilter = THREE.NearestFilter;
waterTexture.minFilter = THREE.NearestFilter;

// Water is built from a grid of tiles rather than one big plane, and tiles that fall inside any
// island's footprint (+ a margin) are skipped — otherwise the flat plane shows through wherever a
// mined-out shaft or cave dips below sea level under an island, making the ocean look like it
// floods straight into the ground there.
const WATER_TILE = 10;
const WATER_MARGIN = 4;
const WATER_UV_SCALE = 5;

// Shared by the water mesh (which tiles are drawn) and isSwimming() (where swim physics applies).
// `margin` defaults to the water mesh's visual buffer, but isSwimming passes 0 so the swim cutoff
// lines up with the real edge of the island's solid terrain (beachR) — using the wider margin there
// too would leave a gap between "stopped swimming" and "reached solid ground" that you'd fall
// through while trying to swim back to shore.
function isNearIsland(x, z, margin = WATER_MARGIN) {
  return ISLANDS.some((isl) => {
    const dx = x - isl.cx, dz = z - isl.cz;
    const r = isl.beachR + margin;
    return dx * dx + dz * dz < r * r;
  });
}

const WATER_MAP_HALF = 450;

// Generates the whole base world (islands + water) from a seed. Called once, either immediately
// with a random seed for solo play, or after the server hands over a room's shared seed for
// multiplayer — see the networking section below.
function generateWorld(seed) {
  rng = mulberry32(seed);
  for (let i = 0; i < 10; i++) tryPlaceIsland(14 + Math.floor(rng() * 9));
  ISLANDS.forEach(generateIsland);
  spawnMobs();
  spawnVillagers();
  spawnHorses();

  const waterPositions = [];
  const waterUvs = [];
  const waterIndices = [];
  let waterVertCount = 0;
  for (let cx = -WATER_MAP_HALF + WATER_TILE / 2; cx < WATER_MAP_HALF; cx += WATER_TILE) {
    for (let cz = -WATER_MAP_HALF + WATER_TILE / 2; cz < WATER_MAP_HALF; cz += WATER_TILE) {
      if (isNearIsland(cx, cz)) continue;
      const half = WATER_TILE / 2;
      const x0 = cx - half, x1 = cx + half, z0 = cz - half, z1 = cz + half;
      waterPositions.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x1, 0, z0);
      waterUvs.push(
        x0 / WATER_UV_SCALE, z0 / WATER_UV_SCALE,
        x0 / WATER_UV_SCALE, z1 / WATER_UV_SCALE,
        x1 / WATER_UV_SCALE, z1 / WATER_UV_SCALE,
        x1 / WATER_UV_SCALE, z0 / WATER_UV_SCALE,
      );
      waterIndices.push(waterVertCount, waterVertCount + 1, waterVertCount + 2, waterVertCount, waterVertCount + 2, waterVertCount + 3);
      waterVertCount += 4;
    }
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
  waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
  waterGeo.setIndex(waterIndices);
  waterGeo.computeVertexNormals();

  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2f8fc4, map: waterTexture, transparent: true, opacity: 0.8 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = -0.15;
  scene.add(water);
}

// ---------- Multiplayer: everyone with the same room code (from the chat menu link) shares one
// world. If there's no room code (opened directly), it's today's solo behavior — a fresh random
// world, no networking at all. ----------
const mpParams = new URLSearchParams(location.search);
const mpRoomCode = mpParams.get('room');
const mpPlayerName = (mpParams.get('name') || 'Player').slice(0, 30);
if (mpRoomCode) {
  const backLink = document.getElementById('back-link');
  if (backLink) backLink.href = `index.html?room=${encodeURIComponent(mpRoomCode)}&name=${encodeURIComponent(mpPlayerName)}`;
}

let bcSocket = null;
let bcMyId = null;
let myShirtColor = localStorage.getItem('valk-bc-skin-color') || '#2fb6ac';
let bcReady = false; // world generated (from seed or solo random) — gates the start-overlay buttons
let bcMultiplayerActive = false; // true only once bc-init actually confirms a shared world (not the solo fallback)
const bcRemotePlayers = new Map(); // id -> { group, target: {x,y,z,yaw} }
const mpStatusEl = document.getElementById('mp-status');
const startCreativeBtn = document.getElementById('start-creative-btn');
const startSurvivalBtn = document.getElementById('start-survival-btn');

function bcSetReady() {
  bcReady = true;
  startCreativeBtn.disabled = false;
  startSurvivalBtn.disabled = false;
  mpStatusEl.classList.add('hidden');
}

function bcApplyChange(x, y, z, t) {
  removeBlockAt(x, y, z);
  if (t !== null && t !== undefined) addBlock(x, y, z, t);
}

// Sends a batch of this player's own block changes (break/place/cave-in) to the shared world.
// Keyed by cell so an action that touches the same cell more than once (a cave-in reshaping
// terrain it just carved) only reports each cell's final state, not every intermediate step.
function bcSendChanges(changesMap) {
  if (changesMap.size === 0 || !bcSocket || bcSocket.readyState !== WebSocket.OPEN) return;
  bcSocket.send(JSON.stringify({ type: 'bc-block', changes: [...changesMap.values()] }));
}

// Builds a simple pixel-art face (skin base, eyes, beard) on a 16x16 canvas, matching the same
// procedural-texture approach the block textures already use — no external image assets.
function bcFaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cd9d75';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(3, 6, 3, 2);
  ctx.fillRect(10, 6, 3, 2);
  ctx.fillStyle = '#4436a6';
  ctx.fillRect(4, 6, 1, 2);
  ctx.fillRect(11, 6, 1, 2);
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(3, 10, 10, 4);
  ctx.fillStyle = '#3b2a1e';
  ctx.fillRect(6, 11, 4, 2);
  return new THREE.CanvasTexture(canvas);
}

// Blocky Steve-style humanoid: legs/shoes, teal-shirt torso, skin-tone arms, a head with a
// pixel-art face on the front and a dark hair block on top.
// Tier -> a metal-ish tint plus a touch of emissive so armor reads as "worn metal/wood" rather
// than just a recolored shirt — matches ARMOR_REDUCTION's keys (see the Armor section below).
const ARMOR_VISUAL = {
  Wooden: { color: 0x8b5a2b, emissive: 0x000000 },
  Stone: { color: 0x8a8a8a, emissive: 0x000000 },
  Iron: { color: 0xd8d8d8, emissive: 0x101010 },
  Gold: { color: 0xffd24d, emissive: 0x352200 },
  Diamond: { color: 0x5fe8e0, emissive: 0x0a3a38 },
};

function bcMakeAvatar(name, shirtColor, armorTier) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xcd9d75 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x3b2a1e });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor || 0x2fb6ac });
  const pants = new THREE.MeshLambertMaterial({ color: 0x4436a6 });
  const shoes = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const armorVisual = ARMOR_VISUAL[armorTier] || null;
  const armorMat = armorVisual && new THREE.MeshLambertMaterial(armorVisual);

  const legGeo = new THREE.BoxGeometry(0.22, 0.63, 0.22);
  const shoeGeo = new THREE.BoxGeometry(0.22, 0.12, 0.22);
  const legArmorGeo = new THREE.BoxGeometry(0.26, 0.4, 0.26);
  [-0.13, 0.13].forEach((xOff) => {
    const leg = new THREE.Mesh(legGeo, pants);
    leg.position.set(xOff, 0.375, 0);
    group.add(leg);
    const shoe = new THREE.Mesh(shoeGeo, shoes);
    shoe.position.set(xOff, 0.06, 0);
    group.add(shoe);
    if (armorMat) {
      // Leggings: covers the top half of each leg, boots left bare so it doesn't just look
      // like recolored pants — same idea as Minecraft's leg-armor coverage.
      const legArmor = new THREE.Mesh(legArmorGeo, armorMat);
      legArmor.position.set(xOff, 0.5, 0);
      group.add(legArmor);
    }
  });

  const torsoY = 0.75 + 0.3;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), shirt);
  torso.position.set(0, torsoY, 0);
  group.add(torso);
  if (armorMat) {
    const chestplate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.64, 0.34), armorMat);
    chestplate.position.set(0, torsoY, 0);
    group.add(chestplate);
  }

  const armGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
  [-0.36, 0.36].forEach((xOff) => {
    const arm = new THREE.Mesh(armGeo, skin);
    arm.position.set(xOff, torsoY, 0);
    group.add(arm);
  });

  const headSize = 0.45;
  const faceMat = new THREE.MeshLambertMaterial({ map: bcFaceTexture() });
  // BoxGeometry material order: +x, -x, +y, -y, +z, -z — face goes on the front (+z).
  const head = new THREE.Mesh(new THREE.BoxGeometry(headSize, headSize, headSize), [skin, skin, hair, skin, faceMat, skin]);
  const headY = 0.75 + 0.6 + headSize / 2;
  head.position.set(0, headY, 0);
  group.add(head);

  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(headSize + 0.03, 0.12, headSize + 0.03), hair);
  hairCap.position.set(0, headY + headSize / 2 - 0.05, -0.01);
  group.add(hairCap);

  if (armorMat) {
    // Helmet: a slightly larger box fully enclosing the head — this does hide the face texture
    // while worn, same tradeoff Minecraft's own helmets make.
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(headSize + 0.08, headSize + 0.08, headSize + 0.08), armorMat);
    helmet.position.set(0, headY, 0);
    group.add(helmet);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(6, 14, 22, 0.75)';
  ctx.fillRect(0, 12, 256, 40);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.3;
  group.add(sprite);
  return group;
}

// Avatar groups are fully rebuilt (bcMakeAvatar) on every color/armor change and on remove —
// dispose the geometries/materials/nametag texture of the old group so GPU memory doesn't
// grow unbounded in a busy or long-running room.
function bcDisposeAvatarGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    }
  });
}

function bcAddRemotePlayer(id, name, pos, color, armorTier) {
  if (id === bcMyId || bcRemotePlayers.has(id)) return;
  const group = bcMakeAvatar(name, color, armorTier || null);
  group.position.set(pos.x, pos.y, pos.z);
  scene.add(group);
  bcRemotePlayers.set(id, { group, name, color, armorTier: armorTier || null, target: { x: pos.x, y: pos.y, z: pos.z, yaw: pos.yaw || 0 } });
}

function bcSetRemotePlayerColor(id, color) {
  const rp = bcRemotePlayers.get(id);
  if (!rp) return;
  const pos = rp.group.position.clone();
  scene.remove(rp.group);
  bcDisposeAvatarGroup(rp.group);
  const group = bcMakeAvatar(rp.name, color, rp.armorTier);
  group.position.copy(pos);
  scene.add(group);
  rp.group = group;
  rp.color = color;
}

function bcSetRemotePlayerArmor(id, armorTier) {
  const rp = bcRemotePlayers.get(id);
  if (!rp) return;
  const pos = rp.group.position.clone();
  scene.remove(rp.group);
  bcDisposeAvatarGroup(rp.group);
  const group = bcMakeAvatar(rp.name, rp.color, armorTier || null);
  group.position.copy(pos);
  scene.add(group);
  rp.group = group;
  rp.armorTier = armorTier || null;
}

function bcRemovePlayer(id) {
  const rp = bcRemotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  bcDisposeAvatarGroup(rp.group);
  bcRemotePlayers.delete(id);
}

function updateRemotePlayers() {
  for (const rp of bcRemotePlayers.values()) {
    rp.group.position.x += (rp.target.x - rp.group.position.x) * 0.25;
    rp.group.position.y += (rp.target.y - rp.group.position.y) * 0.25;
    rp.group.position.z += (rp.target.z - rp.group.position.z) * 0.25;
    rp.group.rotation.y += (rp.target.yaw - rp.group.rotation.y) * 0.25;
  }
}

let lastBcPosSent = 0;
function updateBcPosBroadcast(now) {
  if (!bcSocket || bcSocket.readyState !== WebSocket.OPEN || !gameStarted) return;
  if (now - lastBcPosSent < 120) return;
  lastBcPosSent = now;
  // yawObject.position is the eye/camera position (EYE_HEIGHT above the feet) — broadcast the
  // feet position instead, since that's what the avatar model's own legs/torso/head offsets are
  // built relative to (y=0 at the ground). Sending eye height here was why remote avatars floated
  // roughly EYE_HEIGHT above the terrain.
  bcSocket.send(JSON.stringify({
    type: 'bc-pos',
    x: yawObject.position.x, y: yawObject.position.y - EYE_HEIGHT, z: yawObject.position.z,
    yaw: yawObject.rotation.y,
  }));
}

function connectBc(code, name) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  bcSocket = new WebSocket(`${protocol}//${location.host}`);

  bcSocket.addEventListener('open', () => {
    bcSocket.send(JSON.stringify({ type: 'bc-join', code, name, color: myShirtColor }));
  });

  bcSocket.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      reportClientError('Malformed WS frame: ' + err.message, err.stack);
      return;
    }
    if (data.type === 'bc-init') {
      bcMyId = data.id;
      // setHudVisible() (called once the player actually starts playing) is what reveals
      // voiceToggleBtn — this just marks that it's allowed to, since bc-init only fires for a
      // genuine shared world, never the solo fallback.
      bcMultiplayerActive = true;
      dayNightOffsetMs = data.dayNightOffsetMs || 0;
      bcClaims = data.claims || [];
      generateWorld(data.seed);
      for (const [key, t] of data.overrides) {
        const [x, y, z] = key.split(',').map(Number);
        bcApplyChange(x, y, z, t);
      }
      data.players.forEach((p) => bcAddRemotePlayer(p.id, p.name, p, p.color, p.armorTier));
      bcSetReady();
    } else if (data.type === 'bc-block') {
      data.changes.forEach((c) => bcApplyChange(c.x, c.y, c.z, c.t));
    } else if (data.type === 'bc-claim-added') {
      bcClaims.push({ x: data.x, z: data.z, radius: data.radius, owner: data.owner });
      if (data.owner !== mpPlayerName) showToast(`🚩 ${data.owner} claimed some land nearby`);
    } else if (data.type === 'bc-claim-denied') {
      showToast('🚩 You already have the maximum number of claims');
    } else if (data.type === 'bc-player-joined') {
      bcAddRemotePlayer(data.id, data.name, { x: 0, y: 0, z: 0, yaw: 0 }, data.color);
      showToast(`${data.name} joined the world`);
    } else if (data.type === 'bc-skin-changed') {
      bcSetRemotePlayerColor(data.id, data.color);
    } else if (data.type === 'bc-armor-changed') {
      bcSetRemotePlayerArmor(data.id, data.armorTier);
    } else if (data.type === 'bc-pos') {
      const rp = bcRemotePlayers.get(data.id);
      if (rp) rp.target = { x: data.x, y: data.y, z: data.z, yaw: data.yaw };
    } else if (data.type === 'bc-player-left') {
      bcRemovePlayer(data.id);
    } else if (data.type === 'bc-full') {
      showToast('That world is full (20/20) — starting your own instead');
      generateWorld(Math.floor(Math.random() * 2 ** 31));
      bcSetReady();
    } else if (data.type === 'bc-hit') {
      if (data.targetId === bcMyId) {
        applyHealthChange(data.health, data.byId);
      }
      // Other players' health isn't tracked/shown client-side (only your own hearts render),
      // so a hit on someone else needs no visual update here beyond their own client's HUD.
    } else if (data.type === 'bc-heal') {
      applyHealthChange(data.health, null);
    } else if (data.type === 'bc-sleep-count') {
      if (data.sleeping > 0) showToast(`💤 ${data.sleeping}/${data.total} players sleeping...`);
    } else if (data.type === 'bc-skip-night') {
      dayNightOffsetMs = data.offsetMs;
      isSleeping = false;
      showToast('☀️ Everyone slept through the night!');
    } else if (data.type === 'bc-death') {
      if (data.id === bcMyId) {
        // The server's health here is already the post-respawn value (10), not 0 — the killing
        // blow skips bc-hit entirely, so death has to be triggered directly rather than through
        // applyHealthChange's "did health cross zero" check, which would never see a 0 to react to.
        myHealth = 0;
        renderHealth();
        if (!isDead) die(data.killedBy);
      } else {
        const rp = bcRemotePlayers.get(data.id);
        if (rp) {
          rp.group.position.set(data.respawn.x, data.respawn.y, data.respawn.z);
          rp.target = { x: data.respawn.x, y: data.respawn.y, z: data.respawn.z, yaw: data.respawn.yaw };
          showToast(`💀 ${rp.name} died`);
        }
      }
    } else if (data.type === 'bc-voice-peers') {
      // We just joined voice — we already know about everyone here, so we make the offer to
      // each of them (same "second joiner offers first" convention as the chat page's calls).
      data.peers.forEach((p) => { addBcVoicePeer(p.id, p.name); makeBcVoiceOffer(p.id); });
    } else if (data.type === 'bc-voice-peer-joined') {
      addBcVoicePeer(data.id, data.name);
    } else if (data.type === 'bc-voice-signal') {
      handleBcVoiceSignal(data.from, data.signal);
    } else if (data.type === 'bc-voice-peer-left') {
      removeBcVoicePeer(data.id);
    } else if (data.type === 'bc-chat') {
      addBcChatLine(data.name, data.text);
    } else if (data.type === 'bc-blueprint-list-result') {
      renderBlueprintList(data.blueprints || []);
    } else if (data.type === 'bc-blueprint-get-result') {
      armedBlueprintId = data.id;
      armedBlueprintBlocks = data.blocks;
      renderBlueprintList(blueprints);
      closeBlueprintPanel();
      showToast(`🧱 "${data.name}" armed — right-click a spot to stamp it there`);
    }
  });

  // If the server never responds (unreachable, dropped mid-handshake), fall back to solo play
  // instead of leaving the player stuck on a disabled start screen forever. Both 'error' and
  // 'close' can fire for the same failure, so bcReady (set by bcSetReady) guards against running
  // the fallback twice.
  const bcFallbackToSolo = () => {
    if (bcReady) return;
    showToast('Could not reach the shared world — starting your own instead');
    generateWorld(Math.floor(Math.random() * 2 ** 31));
    bcSetReady();
  };
  bcSocket.addEventListener('error', bcFallbackToSolo);
  bcSocket.addEventListener('close', bcFallbackToSolo);

  // Separate from bcFallbackToSolo, which no-ops once bcReady — this needs to run even if the
  // connection drops mid-session (server restart, network blip) well after the game started.
  bcSocket.addEventListener('close', () => {
    bcMultiplayerActive = false;
    voiceToggleBtn.style.display = 'none';
    resetBcVoice();
  });
}

if (mpRoomCode) {
  mpStatusEl.classList.remove('hidden');
  startCreativeBtn.disabled = true;
  startSurvivalBtn.disabled = true;
  connectBc(mpRoomCode, mpPlayerName);
} else {
  generateWorld(Math.floor(Math.random() * 2 ** 31));
  bcReady = true;
}

// ---------- Voxel raycasting (DDA) ----------
function raycastVoxels(origin, dir, maxDist) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  const fracX = origin.x - Math.floor(origin.x), fracY = origin.y - Math.floor(origin.y), fracZ = origin.z - Math.floor(origin.z);
  let tMaxX = dir.x !== 0 ? ((stepX > 0 ? 1 - fracX : fracX) / Math.abs(dir.x)) : Infinity;
  let tMaxY = dir.y !== 0 ? ((stepY > 0 ? 1 - fracY : fracY) / Math.abs(dir.y)) : Infinity;
  let tMaxZ = dir.z !== 0 ? ((stepZ > 0 ? 1 - fracZ : fracZ) / Math.abs(dir.z)) : Infinity;
  let normal = { x: 0, y: 0, z: 0 };
  let t = 0, guard = 0;
  while (t <= maxDist && guard < 200) {
    guard++;
    if (world.has(keyOf(x, y, z))) return { x, y, z, normal };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = { x: -stepX, y: 0, z: 0 }; }
    else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = { x: 0, y: -stepY, z: 0 }; }
    else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = { x: 0, y: 0, z: -stepZ }; }
  }
  return null;
}

function castRay() {
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  camera.getWorldPosition(origin);
  camera.getWorldDirection(dir);
  return raycastVoxels(origin, dir, REACH);
}

// Wireframe outline on whichever block the crosshair is currently over — shows what a
// left-click would break (and, since placement always goes on a face of this same block,
// where a right-click would build) *before* you click. Purely visual: doBreak()/doPlace()
// are still only ever called from an actual mousedown/hold, same as before.
const targetOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)),
  new THREE.LineBasicMaterial({ color: 0x0a0a0a })
);
targetOutline.visible = false;
scene.add(targetOutline);

function updateTargetOutline() {
  const hit = castRay();
  if (hit) {
    targetOutline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    targetOutline.visible = true;
  } else {
    targetOutline.visible = false;
  }
}

// ---------- Movement, look, physics ----------
const keys = {};
document.addEventListener('keydown', (e) => {
  if (!gameStarted) return;
  if (e.code === 'KeyT' && !inventoryOpen && !craftingOpen) { openBcChat(); return; }
  if (e.code === 'KeyB' && !inventoryOpen && !craftingOpen) { toggleBlueprintPanel(); return; }
  if (e.code === 'KeyE') { toggleInventory(); return; }
  if (e.code === 'KeyC') { toggleCrafting(); return; }
  if (e.code === 'KeyR' && !inventoryOpen && !craftingOpen) { eatSelected(); return; }
  if (e.code === 'KeyF' && !inventoryOpen && !craftingOpen) { tryFish(); return; }
  if (e.code === 'KeyG' && !inventoryOpen && !craftingOpen) {
    vehicleKeyAction();
    return;
  }
  if (e.code === 'KeyY' && !inventoryOpen && !craftingOpen) { toggleArmor(); return; }
  if (e.code === 'KeyM' && !inventoryOpen && !craftingOpen) {
    minimapVisible = !minimapVisible;
    minimapCanvas.style.display = minimapVisible ? 'block' : 'none';
    return;
  }
  if (inventoryOpen || craftingOpen || blueprintOpen) return;
  // Alt alone opens/focuses the browser menu bar in some browsers, which would steal focus before
  // keyup fires and leave keys.AltLeft/Right stuck true (permanent fly-down) — prevent that.
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
  keys[e.code] = true;
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 9) selectSlot(num - 1);
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yawObject.rotation.y -= e.movementX * LOOK_SENSITIVITY;
  pitchObject.rotation.x -= e.movementY * LOOK_SENSITIVITY;
  pitchObject.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitchObject.rotation.x));
});

const up = new THREE.Vector3(0, 1, 0);
// Swimming only applies where the water mesh actually is (open ocean, not under islands) — see
// isNearIsland, shared with the water-tile generation so the physics matches what's rendered.
function isSwimming() {
  const feetY = yawObject.position.y - EYE_HEIGHT;
  return feetY < WATER_LEVEL && !isNearIsland(yawObject.position.x, yawObject.position.z, 0);
}

// ---------- Collision (no clipping through blocks) ----------
const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.8;
function collidesAt(px, py, pz) {
  const feetY = py - EYE_HEIGHT;
  const headY = feetY + PLAYER_HEIGHT;
  const y0 = Math.floor(feetY + 0.05);
  const y1 = Math.floor(headY - 0.05);
  const xs = [Math.floor(px - PLAYER_RADIUS), Math.floor(px + PLAYER_RADIUS)];
  const zs = [Math.floor(pz - PLAYER_RADIUS), Math.floor(pz + PLAYER_RADIUS)];
  for (let y = y0; y <= y1; y++) {
    for (const cx of xs) {
      for (const cz of zs) {
        if (world.has(keyOf(cx, y, cz))) return true;
      }
    }
  }
  return false;
}

// Moves one axis, and if the full step would collide, binary-searches the largest safe
// fraction of it instead of rejecting the whole step — otherwise a fast fall (a big single-
// frame delta) can get permanently stuck hovering just above the surface it's colliding with.
function moveAxis(delta, testAt) {
  if (delta === 0) return 0;
  if (!testAt(delta)) return delta;
  let lo = 0, hi = delta;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (testAt(mid)) hi = mid; else lo = mid;
  }
  return lo;
}

// Resolves each axis separately so the player slides along a wall instead of freezing on contact.
function tryMove(dx, dy, dz) {
  const p = yawObject.position;
  p.x += moveAxis(dx, (d) => collidesAt(p.x + d, p.y, p.z));
  p.z += moveAxis(dz, (d) => collidesAt(p.x, p.y, p.z + d));
  p.y += moveAxis(dy, (d) => collidesAt(p.x, p.y + d, p.z));
}

function updateMovement(delta) {
  const forward = new THREE.Vector3();
  yawObject.getWorldDirection(forward);
  forward.negate(); // Object3D.getWorldDirection() returns the opposite of the way it's facing (unlike Camera's)
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, up);

  const move = new THREE.Vector3();
  if (keys.KeyW) move.add(forward);
  if (keys.KeyS) move.sub(forward);
  if (keys.KeyD) move.add(right);
  if (keys.KeyA) move.sub(right);
  if (touchMoveZ !== 0) move.addScaledVector(forward, -touchMoveZ);
  if (touchMoveX !== 0) move.addScaledVector(right, touchMoveX);

  if (gameMode === 'creative') {
    airborne = false; // free flight never counts as a fall — no fall damage in creative
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(FLY_SPEED * delta);
    let dy = 0;
    if (keys.Space) dy += FLY_SPEED * delta;
    if (keys.ShiftLeft || keys.ShiftRight || keys.AltLeft || keys.AltRight) dy -= FLY_SPEED * delta;
    tryMove(move.x, dy, move.z);
    yawObject.position.y = Math.max(-60, Math.min(150, yawObject.position.y));
    return;
  }

  if (ridingBoat) {
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(BOAT_SPEED * delta);
    tryMove(move.x, 0, move.z);
    yawObject.position.y = WATER_LEVEL + EYE_HEIGHT;
    verticalVelocity = 0;
    airborne = false;
    if (isNearIsland(yawObject.position.x, yawObject.position.z, 0)) toggleBoat(); // drifted onto land — auto-disembark
    return;
  }

  if (ridingMinecart) {
    const feetY = yawObject.position.y - EYE_HEIGHT;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(MINECART_SPEED * delta);
      const targetX = yawObject.position.x + move.x, targetZ = yawObject.position.z + move.z;
      // Only advance onto a cell that actually has rail under it — this is what keeps the cart
      // "on track" instead of free-roaming like a boat does.
      if (isRailBelow(targetX, targetZ, feetY) || isRailBelow(yawObject.position.x, yawObject.position.z, feetY)) {
        tryMove(move.x, 0, move.z);
      }
    }
    const groundY = groundHeightAt(Math.floor(yawObject.position.x), Math.floor(yawObject.position.z));
    if (groundY !== null) yawObject.position.y = groundY + EYE_HEIGHT;
    verticalVelocity = 0;
    airborne = false;
    return;
  }

  const swimming = isSwimming();
  const speed = ridingHorse ? HORSE_SPEED : swimming ? SWIM_SPEED : WALK_SPEED;
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * delta);
  tryMove(move.x, 0, move.z);

  if (swimming && !wasSwimming) playSplashSfx();
  wasSwimming = swimming;

  if (swimming) {
    verticalVelocity = 0;
    airborne = false; // splashing into water cancels any pending fall — no fall damage from a water landing
    let dy = 0;
    if (keys.Space) dy += SWIM_VERTICAL_SPEED * delta;
    if (keys.ShiftLeft || keys.ShiftRight) dy -= SWIM_VERTICAL_SPEED * delta;
    tryMove(0, dy, 0);
  } else {
    // Grounded means "a block sits right under my feet" — checked with collidesAt at the
    // player's actual position, never by comparing against some other column's height, so
    // walking sideways into a taller block can no longer teleport the player onto it.
    const grounded = collidesAt(yawObject.position.x, yawObject.position.y - 0.1, yawObject.position.z);
    if (grounded) {
      if (airborne) {
        applyFallDamage(airPeakY - yawObject.position.y);
        airborne = false;
        playLandSfx();
      }
      if (verticalVelocity < 0) verticalVelocity = 0;
      if (keys.Space) { verticalVelocity = JUMP_SPEED; playJumpSfx(); }
      if (move.lengthSq() > 0) {
        footstepAccum += move.length();
        if (footstepAccum >= FOOTSTEP_STEP_DISTANCE) {
          footstepAccum = 0;
          playFootstepSfx();
        }
      } else {
        footstepAccum = 0;
      }
    } else {
      if (!airborne) airPeakY = yawObject.position.y;
      airborne = true;
      if (yawObject.position.y > airPeakY) airPeakY = yawObject.position.y;
    }
    verticalVelocity += GRAVITY * delta;
    const dy = Math.max(verticalVelocity * delta, -1.5); // cap max fall-per-frame to avoid tunneling
    tryMove(0, dy, 0);
  }
  yawObject.position.y = Math.max(-55, Math.min(150, yawObject.position.y));
}

// ---------- Break-particle effect ----------
const particles = [];
function spawnBreakParticles(x, y, z, typeIndex) {
  const color = blockColor(typeIndex);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), mat.clone());
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    const velocity = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3);
    scene.add(mesh);
    particles.push({ mesh, velocity, spawnedAt: performance.now() });
  }
}

function updateParticles(delta) {
  const now = performance.now();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const life = p.life || 500; // fireworks (see spawnFireworkBurst) use a longer life/slower fall
    const gravity = p.gravity === undefined ? 9 : p.gravity;
    const age = now - p.spawnedAt;
    if (age > life) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
      continue;
    }
    p.velocity.y -= gravity * delta;
    p.mesh.position.addScaledVector(p.velocity, delta);
    p.mesh.material.opacity = 1 - age / life;
    const scale = 1 - age / life;
    p.mesh.scale.set(scale, scale, scale);
  }
}

// ---------- Fireworks ----------
const fireworks = [];
const FIREWORK_COLORS = [0xff4d4d, 0xffd93d, 0x4dff88, 0x4da6ff, 0xff4dff, 0xffffff];

function spawnFireworkBurst(x, y, z) {
  for (let i = 0; i < 40; i++) {
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), mat);
    mesh.position.set(x, y, z);
    const angle = Math.random() * Math.PI * 2;
    const elevation = Math.random() * Math.PI - Math.PI / 2;
    const speed = 4 + Math.random() * 4;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * Math.cos(elevation) * speed,
      Math.sin(elevation) * speed + 1.5,
      Math.sin(angle) * Math.cos(elevation) * speed
    );
    scene.add(mesh);
    particles.push({ mesh, velocity, spawnedAt: performance.now(), life: 1300, gravity: 3 });
  }
}

function launchFirework() {
  const slot = hotbar[selectedSlot];
  if (!slot || slot.typeIndex !== FIREWORK_ROCKET) return;
  if (gameMode === 'survival') {
    const count = survivalInventory.get(FIREWORK_ROCKET) || 0;
    if (count <= 0) return;
    const remaining = count - 1;
    survivalInventory.set(FIREWORK_ROCKET, remaining);
    if (remaining <= 0) slot.typeIndex = null;
    renderHotbar();
  }
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mesh.position.copy(yawObject.position);
  scene.add(mesh);
  fireworks.push({ mesh, velocity: new THREE.Vector3(0, 9, 0), spawnedAt: performance.now() });
  showToast('🎆 Launched a firework!');
  unlockAchievement('pyrotechnic');
}

function updateFireworks(delta) {
  const now = performance.now();
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const fw = fireworks[i];
    fw.velocity.y -= 2 * delta;
    fw.mesh.position.addScaledVector(fw.velocity, delta);
    if (now - fw.spawnedAt > 900) {
      spawnFireworkBurst(fw.mesh.position.x, fw.mesh.position.y, fw.mesh.position.z);
      scene.remove(fw.mesh);
      fireworks.splice(i, 1);
    }
  }
}

// ---------- Item drops (survival pickup) ----------
const drops = [];
const DROP_MIN_Y = -30; // safety floor — despawn instead of falling forever through open air

// Scans straight down from just below the broken cell for the first solid block, mirroring
// groundHeightAt's approach but anchored to this specific column instead of the whole world.
function findGroundBelow(x, y, z) {
  for (let gy = y - 1; gy > DROP_MIN_Y; gy--) {
    if (world.has(keyOf(x, gy, z))) return gy + 1;
  }
  return null;
}

function spawnDrop(x, y, z, typeIndex) {
  const mesh = objectForInventoryEntry(typeIndex);
  mesh.scale.setScalar(BLOCK_TYPES[typeIndex].item ? 0.8 : 1.17);
  mesh.position.set(x + 0.5, y + 0.4, z + 0.5);
  scene.add(mesh);
  const groundY = findGroundBelow(x, y, z);
  // Already resting on solid ground (groundY === y) — keep the old instant-place/bob behavior.
  // Otherwise it was floating (block broken out from under it, or a mid-air structure) and
  // should fall until it lands, same as the player falling under gravity.
  const falling = groundY === null || groundY < y;
  drops.push({ mesh, typeIndex, spawnedAt: performance.now(), falling, groundY, vy: 0 });
}

function updateDrops(delta) {
  const now = performance.now();
  const playerPos = yawObject.position;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.mesh.rotation.y += 0.04;
    if (d.falling) {
      d.vy += GRAVITY * delta;
      d.mesh.position.y += d.vy * delta;
      const restY = d.groundY === null ? DROP_MIN_Y : d.groundY + 0.4;
      if (d.mesh.position.y <= restY) {
        if (d.groundY === null) {
          scene.remove(d.mesh);
          drops.splice(i, 1);
          continue;
        }
        d.mesh.position.y = restY;
        d.falling = false;
        d.vy = 0;
      }
    } else {
      d.mesh.position.y = Math.floor(d.mesh.position.y) + 0.4 + Math.sin(now / 300) * 0.08;
    }
    if (d.mesh.position.distanceTo(playerPos) < PICKUP_RADIUS) {
      scene.remove(d.mesh);
      drops.splice(i, 1);
      collectItem(d.typeIndex);
    }
  }
}

function collectItem(typeIndex, amount = 1) {
  const count = (survivalInventory.get(typeIndex) || 0) + amount;
  survivalInventory.set(typeIndex, count);
  const existingSlot = hotbar.findIndex((s) => s.typeIndex === typeIndex);
  if (existingSlot === -1) {
    const emptySlot = hotbar.findIndex((s) => s.typeIndex === null);
    if (emptySlot !== -1) hotbar[emptySlot].typeIndex = typeIndex;
  }
  renderHotbar();
}

// ---------- Farming ----------
// cellKey -> plantedAt (performance.now()). Growth stage is a pure function of elapsed time, same
// trick the day/night cycle uses, so every client agrees without any extra network messages —
// the only thing that needs to actually sync is the block-type swap itself, which reuses the
// same bc-block diff channel as any other placed/broken block.
const crops = new Map();
let lastCropCheckAt = 0;

function plantSeed(x, y, z) {
  addBlock(x, y, z, WHEAT_SPROUT);
  crops.set(keyOf(x, y, z), 0); // accumulated growth time (ms) — see updateCrops for why this
  // isn't just a plantedAt timestamp: rain needs to make time accumulate faster.
  bcSendChanges(new Map([[keyOf(x, y, z), { x, y, z, t: WHEAT_SPROUT }]]));
}

const RAIN_GROWTH_MULTIPLIER = 2; // rain doubles crop growth speed, same idea as real farming

function updateCrops() {
  const now = performance.now();
  const elapsed = now - lastCropCheckAt;
  if (elapsed < 2000) return;
  // Growth accumulates faster while it's raining instead of being a fixed plantedAt timestamp,
  // so a rainstorm mid-grow actually speeds up whatever's already in the ground too.
  const effectiveElapsed = elapsed * (isRaining ? RAIN_GROWTH_MULTIPLIER : 1);
  lastCropCheckAt = now;
  for (const [key, grownMs] of crops) {
    const newGrownMs = grownMs + effectiveElapsed;
    const stageIdx = Math.min(2, Math.floor(newGrownMs / CROP_STAGE_MS));
    const targetType = CROP_STAGES[stageIdx];
    const currentType = world.get(key);
    if (currentType === undefined || currentType === targetType) {
      if (stageIdx >= 2) crops.delete(key); // fully grown — stop tracking, still harvestable via doBreak
      else crops.set(key, newGrownMs);
      continue;
    }
    const [x, y, z] = key.split(',').map(Number);
    removeBlockAt(x, y, z);
    addBlock(x, y, z, targetType);
    bcSendChanges(new Map([[key, { x, y, z, t: targetType }]]));
    if (stageIdx >= 2) crops.delete(key);
    else crops.set(key, newGrownMs);
  }
}

const FOOD_HEAL = { [WHEAT_ITEM]: 2, [RAW_FISH]: 3 };
const FOOD_LABEL = { [WHEAT_ITEM]: '🍞 Ate wheat', [RAW_FISH]: '🐟 Ate raw fish' };

function eatSelected() {
  const slot = hotbar[selectedSlot];
  const amount = slot && FOOD_HEAL[slot.typeIndex];
  if (!amount || isDead || myHealth >= BC_MAX_HEALTH) return;
  if (gameMode === 'survival') {
    const count = survivalInventory.get(slot.typeIndex) || 0;
    if (count <= 0) return;
    const remaining = count - 1;
    survivalInventory.set(slot.typeIndex, remaining);
    if (remaining <= 0) slot.typeIndex = null;
    renderHotbar();
  }
  if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(JSON.stringify({ type: 'bc-eat', amount }));
  } else {
    applyHealthChange(myHealth + amount, null);
  }
  showToast(`${FOOD_LABEL[slot.typeIndex]} (+${amount} ❤️)`);
}

// ---------- Armor ----------
// A flat "% chance to block 1 damage per hit" rather than a %-of-amount reduction — most hits
// here (a punch, a mob bite) only deal 1 point to begin with, and a fractional reduction would
// just round back up to 1 every time, making armor feel like it does nothing against exactly the
// most common kind of damage. Multiplayer applies this server-side (see applyBcDamage) since
// health there is authoritative; solo applies it locally in reportFallDamage below.
const ARMOR_REDUCTION = { Wooden: 0.10, Stone: 0.20, Iron: 0.35, Gold: 0.40, Diamond: 0.55 };
let equippedArmorName = null;
let equippedArmorReduction = 0;
let equippedArmorTier = null; // e.g. 'Iron' — what gets broadcast so other players see it worn

function toggleArmor() {
  const slot = hotbar[selectedSlot];
  if (!slot || slot.typeIndex === null) return;
  const type = BLOCK_TYPES[slot.typeIndex];
  if (!type.name.endsWith(' Armor')) return;
  if (equippedArmorName === type.name) {
    equippedArmorName = null;
    equippedArmorReduction = 0;
    equippedArmorTier = null;
    showToast('🛡️ Armor unequipped');
  } else {
    const tier = type.name.split(' ')[0];
    equippedArmorName = type.name;
    equippedArmorReduction = ARMOR_REDUCTION[tier] || 0;
    equippedArmorTier = tier;
    showToast(`🛡️ Equipped ${type.name} (${Math.round(equippedArmorReduction * 100)}% block chance)`);
    if (type.name === 'Diamond Armor') unlockAchievement('full_diamond_armor');
  }
  if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(JSON.stringify({ type: 'bc-set-armor', reduction: equippedArmorReduction, armorTier: equippedArmorTier }));
  }
}

// ---------- Sleep (bed interaction, skips to morning) ----------
const SLEEP_PHASE_TARGET = 0.27; // roughly sunrise
let isSleeping = false;

function isNightPhase() {
  const phase = ((Date.now() + dayNightOffsetMs) % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  return phase < 0.2 || phase > 0.8;
}

function skipToMorningLocal() {
  const now = Date.now();
  const phase = ((now + dayNightOffsetMs) % DAY_CYCLE_MS) / DAY_CYCLE_MS;
  const targetPhase = phase > 0.8 ? 1 + SLEEP_PHASE_TARGET : SLEEP_PHASE_TARGET;
  dayNightOffsetMs += (targetPhase - phase) * DAY_CYCLE_MS;
  isSleeping = false;
  showToast('☀️ Morning!');
}

function trySleep() {
  if (isDead || isSleeping) return;
  if (!isNightPhase()) {
    showToast('☀️ You can only sleep at night');
    return;
  }
  if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    isSleeping = true;
    bcSocket.send(JSON.stringify({ type: 'bc-sleep' }));
    showToast('💤 Sleeping... waiting for everyone else');
  } else {
    skipToMorningLocal();
  }
}

// ---------- Enchanting ----------
// Tools/armor here are just stack counts by type (no per-item identity — see survivalInventory),
// so an enchant applies to the whole *type* rather than one specific pickaxe, unlike Minecraft.
// Simplification forced by that data model, not an oversight.
const enchantedEfficiency = new Set(); // tool typeIndex -> faster repeat-mining
const enchantedFortune = new Set(); // tool typeIndex -> chance of a bonus drop when mining

function isToolItem(typeIndex) {
  const type = BLOCK_TYPES[typeIndex];
  return !!type && type.item && /Pickaxe|Axe|Shovel|Sword|Hoe/.test(type.name);
}

function tryEnchant() {
  const slot = hotbar[selectedSlot];
  if (!slot || !isToolItem(slot.typeIndex)) {
    showToast('🔮 Hold a tool to enchant it');
    return;
  }
  const typeIndex = slot.typeIndex;
  if (enchantedEfficiency.has(typeIndex) && enchantedFortune.has(typeIndex)) {
    showToast('🔮 Already fully enchanted!');
    return;
  }
  if (gameMode === 'survival') {
    const count = survivalInventory.get(LAPIS_ORE) || 0;
    if (count < 2) {
      showToast('🔮 Need 2 Lapis Ore to enchant');
      return;
    }
    survivalInventory.set(LAPIS_ORE, count - 2);
    renderHotbar();
  }
  const applyEfficiency = !enchantedEfficiency.has(typeIndex) && (enchantedFortune.has(typeIndex) || Math.random() < 0.5);
  if (applyEfficiency) {
    enchantedEfficiency.add(typeIndex);
    showToast(`✨ ${BLOCK_TYPES[typeIndex].name} enchanted: Efficiency!`);
  } else {
    enchantedFortune.add(typeIndex);
    showToast(`✨ ${BLOCK_TYPES[typeIndex].name} enchanted: Fortune!`);
  }
  unlockAchievement('first_enchant');
}

function currentBreakInterval() {
  const slot = hotbar[selectedSlot];
  return slot && enchantedEfficiency.has(slot.typeIndex) ? BREAK_INTERVAL * 0.5 : BREAK_INTERVAL;
}

// ---------- Fishing ----------
// No water voxels to raycast against (the ocean is a flat plane, not part of `world`), so
// fishing is gated on player position instead of a block hit — same idea as isSwimming().
let fishingUntil = 0; // performance.now() timestamp a pending catch resolves at, 0 = not fishing
let lastFishAt = 0;
const FISH_COOLDOWN_MS = 1500;

function tryFish() {
  const slot = hotbar[selectedSlot];
  if (!slot || slot.typeIndex !== FISHING_ROD || isDead) return;
  const now = performance.now();
  if (fishingUntil || now - lastFishAt < FISH_COOLDOWN_MS) return;
  const feetY = yawObject.position.y - EYE_HEIGHT;
  const inWater = feetY < WATER_LEVEL + 0.5 && !isNearIsland(yawObject.position.x, yawObject.position.z, 0);
  if (!inWater) {
    showToast('🎣 You need to be near open water to fish');
    return;
  }
  lastFishAt = now;
  fishingUntil = now + 2000 + Math.random() * 3000;
  playFishCastSfx();
  showToast('🎣 Casting your line...');
}

function updateFishing() {
  if (!fishingUntil || performance.now() < fishingUntil) return;
  fishingUntil = 0;
  if (Math.random() < 0.7) {
    if (gameMode === 'survival') collectItem(RAW_FISH, 1);
    playFishCatchSfx();
    showToast('🐟 You caught a fish!');
  } else {
    playFishFailSfx();
    showToast('💧 The fish got away...');
  }
}

// ---------- Boats ----------
// Riding is a client-local movement mode (like flight in creative), not a separate placeable
// multiplayer entity — same "no server round-trip needed" reasoning as the day/night cycle,
// since a boat only ever needs to be consistent for the one person riding it.
let ridingBoat = false;
let boatMesh = null;

function buildBoatMesh() {
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 2.2), new THREE.MeshLambertMaterial({ color: 0x8a5a34 }));
  hull.position.set(0, -EYE_HEIGHT + 0.15, 0);
  return hull;
}

function toggleBoat() {
  if (isDead) return;
  if (!ridingBoat) {
    const slot = hotbar[selectedSlot];
    if (!slot || slot.typeIndex !== BOAT_ITEM) return;
    const feetY = yawObject.position.y - EYE_HEIGHT;
    const inWater = feetY < WATER_LEVEL + 0.5 && !isNearIsland(yawObject.position.x, yawObject.position.z, 0);
    if (!inWater) {
      showToast('🚤 You need open water to launch a boat');
      return;
    }
    if (gameMode === 'survival') {
      const count = survivalInventory.get(BOAT_ITEM) || 0;
      if (count <= 0) return;
      const remaining = count - 1;
      survivalInventory.set(BOAT_ITEM, remaining);
      if (remaining <= 0) slot.typeIndex = null;
      renderHotbar();
    }
    ridingBoat = true;
    boatMesh = buildBoatMesh();
    yawObject.add(boatMesh);
    showToast('🚤 Boarded the boat (G to exit)');
  } else {
    ridingBoat = false;
    if (boatMesh) { yawObject.remove(boatMesh); bcDisposeAvatarGroup(boatMesh); boatMesh = null; }
    if (gameMode === 'survival') collectItem(BOAT_ITEM, 1); // pick the boat back up, Minecraft-style
    showToast('🚤 Left the boat');
  }
}

// ---------- Minecarts ----------
// Same client-local "riding is a movement mode" trick as boats, but gravity-free and gated on
// standing over an actual Rail block instead of open water — the minecart can only move onto a
// cell that has rail beneath it, so a real track has to be laid to go anywhere.
let ridingMinecart = false;
let minecartMesh = null;

function buildMinecartMesh() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x6b6b6b });
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.7), mat);
  base.position.set(0, -EYE_HEIGHT + 0.15, 0);
  group.add(base);
  [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(([x, z]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), mat);
    wall.position.set(x, -EYE_HEIGHT + 0.32, z);
    group.add(wall);
  });
  return group;
}

function isRailBelow(x, z, feetY) {
  return world.get(keyOf(Math.floor(x), Math.round(feetY) - 1, Math.floor(z))) === RAIL;
}

function toggleMinecart() {
  if (isDead) return;
  if (!ridingMinecart) {
    const slot = hotbar[selectedSlot];
    if (!slot || slot.typeIndex !== MINECART_ITEM) return;
    const feetY = yawObject.position.y - EYE_HEIGHT;
    if (!isRailBelow(yawObject.position.x, yawObject.position.z, feetY)) {
      showToast('🛤️ You need to be standing on rail to place a minecart');
      return;
    }
    if (gameMode === 'survival') {
      const count = survivalInventory.get(MINECART_ITEM) || 0;
      if (count <= 0) return;
      const remaining = count - 1;
      survivalInventory.set(MINECART_ITEM, remaining);
      if (remaining <= 0) slot.typeIndex = null;
      renderHotbar();
    }
    ridingMinecart = true;
    minecartMesh = buildMinecartMesh();
    yawObject.add(minecartMesh);
    showToast('🛒 Boarded the minecart (G to exit)');
  } else {
    ridingMinecart = false;
    if (minecartMesh) { yawObject.remove(minecartMesh); bcDisposeAvatarGroup(minecartMesh); minecartMesh = null; }
    if (gameMode === 'survival') collectItem(MINECART_ITEM, 1);
    showToast('🛒 Left the minecart');
  }
}

// ---------- Cave mechanic: mine 10 blocks straight down for a 30% chance ----------
const digStreak = { x: null, z: null, y: null, count: 0 };
function checkDigStreak(x, y, z) {
  if (digStreak.x === x && digStreak.z === z && digStreak.y === y + 1) digStreak.count += 1;
  else digStreak.count = 1;
  digStreak.x = x; digStreak.z = z; digStreak.y = y;
  if (digStreak.count >= 10) {
    digStreak.count = 0;
    if (Math.random() < 0.3) carveCave(x, y - 2, z);
  }
}

const CAVE_DIAMOND_ORE = indexOf('Diamond Ore');
const CAVE_IRON_ORE = indexOf('Iron Ore');
const CAVE_COAL_ORE = indexOf('Coal Ore');

// Diamond, iron, and coal each get their own independent roll — rarest checked first
// so a wall block that qualifies for more than one only ever becomes the rarer ore.
function rollCaveOre() {
  if (Math.random() < 0.10) return CAVE_DIAMOND_ORE;
  if (Math.random() < 0.50) return CAVE_IRON_ORE;
  if (Math.random() < 0.70) return CAVE_COAL_ORE;
  return null;
}

function carveCave(cx, cy, cz) {
  const R = 7;
  const changes = new Map();
  const record = (x, y, z, t) => changes.set(`${x},${y},${z}`, { x, y, z, t });
  // Unlike every direct break/place action, this fires from a dig-streak RNG roll with no
  // per-cell UI to gate on — without this check a cave-in could delete a 7-radius sphere of
  // someone else's claimed build just by a third party mining nearby.
  const claimGuard = bcMultiplayerActive
    ? (x, z) => isCellClaimedByOther(x, z)
    : () => false;
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (dx * dx + dy * dy + dz * dz <= R * R) {
          const x = cx + dx, y = cy + dy, z = cz + dz;
          if (claimGuard(x, z)) continue;
          if (removeBlockAt(x, y, z) !== null) record(x, y, z, null);
        }
      }
    }
  }
  // Seed ore into the shell of blocks left standing just outside the hollow.
  const shellMinSq = R * R;
  const shellMaxSq = (R + 2) * (R + 2);
  for (let dx = -(R + 2); dx <= R + 2; dx++) {
    for (let dy = -(R + 2); dy <= R + 2; dy++) {
      for (let dz = -(R + 2); dz <= R + 2; dz++) {
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq <= shellMinSq || distSq > shellMaxSq) continue;
        const x = cx + dx, y = cy + dy, z = cz + dz;
        if (claimGuard(x, z)) continue;
        if (!world.has(keyOf(x, y, z))) continue;
        const ore = rollCaveOre();
        if (ore === null) continue;
        removeBlockAt(x, y, z);
        addBlock(x, y, z, ore);
        record(x, y, z, ore);
      }
    }
  }
  if (!claimGuard(cx, cz)) {
    removeBlockAt(cx, cy + R - 2, cz);
    const lantern = indexOf('Sea Lantern');
    addBlock(cx, cy + R - 2, cz, lantern);
    record(cx, cy + R - 2, cz, lantern);
  }
  bcSendChanges(changes);
  showToast('⛏️ You found a wide cave, glittering with ore!');
}

// ---------- Break / place ----------
function doBreak() {
  if (isDead) return;
  if (bcRemotePlayers.size > 0 || mobs.length > 0) {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);
    const punchTarget = findPunchTarget(origin, dir);
    if (punchTarget) {
      const blockHit = raycastVoxels(origin, dir, REACH);
      const blockDist = blockHit
        ? origin.distanceTo(new THREE.Vector3(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5))
        : Infinity;
      if (punchTarget.t < blockDist) {
        if (punchTarget.mob) hitMob(punchTarget.mob);
        else tryPunch(punchTarget.id);
        return;
      }
    }
  }
  const hit = castRay();
  if (!hit) return;
  if (bcMultiplayerActive && isCellClaimedByOther(hit.x, hit.z)) {
    showToast('🚧 This area is claimed by someone else');
    return;
  }
  const typeIndex = removeBlockAt(hit.x, hit.y, hit.z);
  if (typeIndex === null) return;
  spawnBreakParticles(hit.x, hit.y, hit.z, typeIndex);
  playBreakSfx(typeIndex);
  if (hit.y < -20) unlockAchievement('deep_diver');
  if (CROP_STAGES.includes(typeIndex)) {
    crops.delete(keyOf(hit.x, hit.y, hit.z));
    if (gameMode === 'survival' && typeIndex === WHEAT_RIPE) {
      spawnDrop(hit.x, hit.y, hit.z, WHEAT_ITEM);
      spawnDrop(hit.x, hit.y, hit.z, WHEAT_SEEDS);
      unlockAchievement('first_harvest');
    }
  } else if (gameMode === 'survival') {
    spawnDrop(hit.x, hit.y, hit.z, typeIndex);
    // A small chance of seeds from grass, same idea as Minecraft's tall-grass drop — this app
    // has no tall-grass decoration to punch instead, so the grass block itself doubles as the source.
    if (typeIndex === GRASS && Math.random() < 0.15) spawnDrop(hit.x, hit.y, hit.z, WHEAT_SEEDS);
    const heldSlot = hotbar[selectedSlot];
    if (heldSlot && enchantedFortune.has(heldSlot.typeIndex) && Math.random() < 0.4) spawnDrop(hit.x, hit.y, hit.z, typeIndex);
  }
  bcSendChanges(new Map([[`${hit.x},${hit.y},${hit.z}`, { x: hit.x, y: hit.y, z: hit.z, t: null }]]));
  checkDigStreak(hit.x, hit.y, hit.z);
}

function doPlace() {
  if (isDead) return;
  placeSwingStart = performance.now();

  // Fireworks launch straight up regardless of what's being looked at (sky or ground), so this
  // has to be handled before castRay() below, which would otherwise bail out on an empty sky.
  const heldSlotForFirework = hotbar[selectedSlot];
  if (heldSlotForFirework && heldSlotForFirework.typeIndex === FIREWORK_ROCKET) {
    launchFirework();
    return;
  }

  // Right-click to equip/unequip a held armor piece — same "acts on you, not the world" logic
  // as the firework check above, so it takes priority over a coincidentally-nearby villager/horse.
  const heldSlotForArmor = hotbar[selectedSlot];
  if (heldSlotForArmor && heldSlotForArmor.typeIndex !== null && BLOCK_TYPES[heldSlotForArmor.typeIndex].name.endsWith(' Armor')) {
    toggleArmor();
    return;
  }

  if (villagers.length > 0 || horses.length > 0) {
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);
    const villagerTarget = villagers.length > 0 ? findVillagerTarget(origin, dir) : null;
    const horseTarget = horses.length > 0 ? findHorseTarget(origin, dir) : null;
    const nearestEntityT = Math.min(villagerTarget ? villagerTarget.t : Infinity, horseTarget ? horseTarget.t : Infinity);
    if (nearestEntityT < Infinity) {
      const blockHit = raycastVoxels(origin, dir, REACH);
      const blockDist = blockHit
        ? origin.distanceTo(new THREE.Vector3(blockHit.x + 0.5, blockHit.y + 0.5, blockHit.z + 0.5))
        : Infinity;
      if (nearestEntityT < blockDist) {
        if (villagerTarget && villagerTarget.t === nearestEntityT) tradeWithVillager();
        else tryInteractHorse(horseTarget.horse);
        return;
      }
    }
  }

  const hit = castRay();
  if (!hit) return;
  const gx = hit.x + hit.normal.x, gy = hit.y + hit.normal.y, gz = hit.z + hit.normal.z;

  // Claim check must use the cell the new block actually lands in (gx/gz), not the cell being
  // looked at (hit.x/hit.z) — those differ by one cell along the face normal, which let a player
  // standing just outside a claim place a block one cell inside it by aiming at their own
  // unclaimed block's face.
  if (bcMultiplayerActive && isCellClaimedByOther(gx, gz)) {
    showToast('🚧 This area is claimed by someone else');
    return;
  }

  if (armedBlueprintBlocks) {
    stampBlueprint(gx, gy, gz);
    return;
  }

  // Sleeping: right-clicking a Bed always tries to sleep, regardless of what's in hand.
  if (world.get(keyOf(hit.x, hit.y, hit.z)) === BED) {
    trySleep();
    return;
  }

  // Enchanting: right-clicking an Enchant Table with a tool selected always tries to enchant it.
  if (world.get(keyOf(hit.x, hit.y, hit.z)) === ENCHANT_TABLE) {
    tryEnchant();
    return;
  }

  const slot = hotbar[selectedSlot];

  // Hoeing: swap Dirt/Grass into Farmland in place — targets the block actually looked at
  // (hit.*), not the empty cell beside it (gx/gy/gz) like every other placement action does.
  if (slot && HOE_TYPES.has(slot.typeIndex)) {
    const hitType = world.get(keyOf(hit.x, hit.y, hit.z));
    if ((hitType === DIRT || hitType === GRASS) && !world.has(keyOf(hit.x, hit.y + 1, hit.z))) {
      removeBlockAt(hit.x, hit.y, hit.z);
      addBlock(hit.x, hit.y, hit.z, FARMLAND);
      playPlaceSfx(FARMLAND);
      bcSendChanges(new Map([[keyOf(hit.x, hit.y, hit.z), { x: hit.x, y: hit.y, z: hit.z, t: FARMLAND }]]));
      return;
    }
  }

  if (world.has(keyOf(gx, gy, gz))) return;

  // Planting: Wheat Seeds only "place" on top of Farmland, and become a growing crop instead
  // of a placed block.
  if (slot && slot.typeIndex === WHEAT_SEEDS && gy === hit.y + 1 && world.get(keyOf(hit.x, hit.y, hit.z)) === FARMLAND) {
    if (gameMode === 'survival') {
      const count = survivalInventory.get(WHEAT_SEEDS) || 0;
      if (count <= 0) return;
      const remaining = count - 1;
      survivalInventory.set(WHEAT_SEEDS, remaining);
      if (remaining <= 0) slot.typeIndex = null;
      renderHotbar();
    }
    plantSeed(gx, gy, gz);
    return;
  }

  if (!slot || slot.typeIndex === null) return;
  if (BLOCK_TYPES[slot.typeIndex].item) return;

  if (gameMode === 'survival') {
    const count = survivalInventory.get(slot.typeIndex) || 0;
    if (count <= 0) return;
    addBlock(gx, gy, gz, slot.typeIndex);
    const remaining = count - 1;
    survivalInventory.set(slot.typeIndex, remaining);
    if (remaining <= 0) slot.typeIndex = null;
    renderHotbar();
  } else {
    addBlock(gx, gy, gz, slot.typeIndex);
  }
  playPlaceSfx(slot.typeIndex);
  bcSendChanges(new Map([[`${gx},${gy},${gz}`, { x: gx, y: gy, z: gz, t: slot.typeIndex }]]));
  if (slot.typeIndex === CLAIM_FLAG) {
    unlockAchievement('home_owner');
    if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
      bcSocket.send(JSON.stringify({ type: 'bc-claim', x: gx, y: gy, z: gz }));
    }
  }
}

// ---------- Blueprints (multiplayer only — saved/listed per room, server-persisted) ----------
// A blueprint is just a list of {dx,dy,dz,t} offsets from wherever it was captured — placing it
// re-anchors those offsets at the newly clicked spot, same idea as copy/paste.
const BP_RADIUS = 6;
const blueprintPanel = document.getElementById('blueprint-panel');
const blueprintSaveForm = document.getElementById('blueprint-save-form');
const blueprintNameInput = document.getElementById('blueprint-name-input');
const blueprintListEl = document.getElementById('blueprint-list');
let blueprintOpen = false;
let blueprints = [];
let armedBlueprintId = null;
let armedBlueprintBlocks = null;

function toggleBlueprintPanel() {
  if (inventoryOpen || craftingOpen) return;
  if (blueprintOpen) closeBlueprintPanel(); else openBlueprintPanel();
}

function openBlueprintPanel() {
  blueprintOpen = true;
  blueprintPanel.classList.remove('hidden');
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  if (bcMultiplayerActive && bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(JSON.stringify({ type: 'bc-blueprint-list' }));
  } else {
    renderBlueprintList([]);
  }
}

function closeBlueprintPanel() {
  blueprintOpen = false;
  blueprintPanel.classList.add('hidden');
}
document.getElementById('blueprint-close-btn').addEventListener('click', closeBlueprintPanel);

function renderBlueprintList(list) {
  blueprints = list;
  blueprintListEl.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.textContent = bcMultiplayerActive ? 'No blueprints saved yet.' : 'Blueprints need a shared world — open Build Craft from the chat menu.';
    blueprintListEl.appendChild(li);
    return;
  }
  list.forEach((bp) => {
    const row = document.createElement('li');
    row.className = 'blueprint-row';
    if (bp.id === armedBlueprintId) row.classList.add('armed');
    const info = document.createElement('div');
    info.className = 'blueprint-row-info';
    const name = document.createElement('span');
    name.className = 'bp-name';
    name.textContent = bp.name;
    const meta = document.createElement('span');
    meta.className = 'bp-meta';
    meta.textContent = `by ${bp.author} · ${bp.sizeX}×${bp.sizeY}×${bp.sizeZ}`;
    info.append(name, meta);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = bp.id === armedBlueprintId ? 'Armed ✓' : 'Place';
    btn.addEventListener('click', () => {
      if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
        bcSocket.send(JSON.stringify({ type: 'bc-blueprint-get', id: bp.id }));
      }
    });
    row.append(info, btn);
    blueprintListEl.appendChild(row);
  });
}

blueprintSaveForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = blueprintNameInput.value.trim();
  if (!bcMultiplayerActive || !bcSocket || bcSocket.readyState !== WebSocket.OPEN) {
    showToast('Blueprints need a shared world — open Build Craft from the chat menu.');
    return;
  }
  if (!name) return;
  const px = Math.floor(yawObject.position.x);
  const pz = Math.floor(yawObject.position.z);
  const py = Math.floor(yawObject.position.y - EYE_HEIGHT);
  const blocks = [];
  for (let dx = -BP_RADIUS; dx <= BP_RADIUS; dx++) {
    for (let dy = -BP_RADIUS; dy <= BP_RADIUS; dy++) {
      for (let dz = -BP_RADIUS; dz <= BP_RADIUS; dz++) {
        const t = world.get(keyOf(px + dx, py + dy, pz + dz));
        if (t !== undefined) blocks.push({ dx, dy, dz, t });
      }
    }
  }
  if (!blocks.length) {
    showToast('Nothing built nearby to save');
    return;
  }
  const size = BP_RADIUS * 2 + 1;
  bcSocket.send(JSON.stringify({ type: 'bc-blueprint-save', name, blocks, sizeX: size, sizeY: size, sizeZ: size }));
  blueprintNameInput.value = '';
  showToast(`💾 Saved "${name}" (${blocks.length} blocks)`);
});

// addBlock() silently no-ops on an already-occupied cell (it's not a "replace"), so stamping
// over terrain — the normal case, not the exception — needs an explicit remove first.
function stampBlueprint(ox, oy, oz) {
  const changes = new Map();
  for (const b of armedBlueprintBlocks) {
    const x = ox + b.dx, y = oy + b.dy, z = oz + b.dz;
    if (world.has(keyOf(x, y, z))) removeBlockAt(x, y, z);
    addBlock(x, y, z, b.t);
    changes.set(`${x},${y},${z}`, { x, y, z, t: b.t });
  }
  bcSendChanges(changes);
  showToast(`🧱 Stamped ${armedBlueprintBlocks.length} blocks`);
  armedBlueprintId = null;
  armedBlueprintBlocks = null;
}

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

let leftDown = false;
let rightDown = false;
let lastBreakAt = 0;
let lastPlaceAt = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const now = performance.now();
  if (e.button === 0) { leftDown = true; lastBreakAt = now; doBreak(); }
  else if (e.button === 2) { rightDown = true; lastPlaceAt = now; doPlace(); }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) leftDown = false;
  else if (e.button === 2) rightDown = false;
});

function updateHeldButtons() {
  if (document.pointerLockElement !== renderer.domElement && !isTouchDevice) return;
  const now = performance.now();
  if (leftDown && now - lastBreakAt >= currentBreakInterval()) { lastBreakAt = now; doBreak(); }
  if (rightDown && now - lastPlaceAt >= PLACE_INTERVAL) { lastPlaceAt = now; doPlace(); }
}

// ---------- First-person arm ----------
const armGroup = new THREE.Group();
const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.9), new THREE.MeshLambertMaterial({ color: 0xe0ac8f }));
armMesh.position.set(0, 0, -0.45);
armGroup.add(armMesh);
const heldItemGroup = new THREE.Group();
heldItemGroup.position.set(0, 0.08, -0.95);
heldItemGroup.visible = false;
armGroup.add(heldItemGroup);
armGroup.position.set(0.45, -0.45, -0.6);
armGroup.rotation.set(0.3, -0.4, 0.15);
camera.add(armGroup);

// ---------- Non-block item shapes (sticks/ingots/tools get their own silhouette instead of a cube) ----------
const STICK_HANDLE_COLOR = 0xa9825a;
function itemMat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function buildStickShape(color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), itemMat(color));
  mesh.rotation.z = Math.PI / 2.6;
  return mesh;
}

function buildIngotShape(color) {
  return new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.18), itemMat(color));
}

function buildToolShape(tool, color) {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), itemMat(STICK_HANDLE_COLOR));
  group.add(handle);
  const mat = itemMat(color);
  if (tool === 'Pickaxe') {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), mat);
    a.position.set(0.08, 0.28, 0); a.rotation.z = 0.6;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), mat);
    b.position.set(-0.08, 0.28, 0); b.rotation.z = -0.6;
    group.add(a, b);
  } else if (tool === 'Axe') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.06), mat);
    head.position.set(0.14, 0.27, 0);
    group.add(head);
  } else if (tool === 'Shovel') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.05), mat);
    head.position.set(0, 0.3, 0);
    group.add(head);
  } else if (tool === 'Sword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.05), mat);
    blade.position.set(0, 0.42, 0);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.06), mat);
    guard.position.set(0, 0.18, 0);
    group.add(blade, guard);
  } else if (tool === 'Hoe') {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.05), mat);
    head.position.set(0.12, 0.27, 0);
    group.add(head);
  }
  return group;
}

// Builds the 3D shape for a hand-held or dropped item; falls back to a plain cube for real blocks.
function objectForInventoryEntry(typeIndex) {
  const type = BLOCK_TYPES[typeIndex];
  if (!type.item) return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), materialFor(typeIndex));
  const group = new THREE.Group();
  if (type.name === 'Stick') group.add(buildStickShape(type.color));
  else if (type.name.endsWith('Ingot')) group.add(buildIngotShape(type.color));
  else if (type.name === 'Wheat Seeds' || type.name === 'Wheat' || type.name === 'Raw Fish' || type.name === 'Boat' || type.name === 'Emerald' || type.name === 'Minecart' || type.name === 'Firework Rocket' || type.name.endsWith(' Armor')) group.add(buildIngotShape(type.color)); // flat item shape stands in fine for a crop/food/boat/gem/cart/rocket/armor icon
  else if (type.name === 'Fishing Rod') group.add(buildToolShape('Shovel', type.color)); // reuses a thin-stick tool shape, close enough for a rod
  else group.add(buildToolShape(type.name.split(' ')[1], type.color));
  group.rotation.set(0.5, 0, 0.9);
  return group;
}

let placeSwingStart = 0;
const PLACE_SWING_DURATION = 220;
function updateArm(now) {
  let mineOffset = 0;
  if (leftDown) mineOffset = Math.sin(now / 70) * 0.5;
  let placeOffset = 0;
  const placeElapsed = now - placeSwingStart;
  if (placeElapsed >= 0 && placeElapsed < PLACE_SWING_DURATION) {
    placeOffset = Math.sin((placeElapsed / PLACE_SWING_DURATION) * Math.PI) * 0.6;
  }
  armGroup.rotation.x = 0.3 - mineOffset - placeOffset;
}

function updateHeldItemVisual() {
  const slot = hotbar[selectedSlot];
  while (heldItemGroup.children.length) heldItemGroup.remove(heldItemGroup.children[0]);
  if (slot && slot.typeIndex !== null) {
    heldItemGroup.visible = true;
    heldItemGroup.add(objectForInventoryEntry(slot.typeIndex));
  } else {
    heldItemGroup.visible = false;
  }
}

// ---------- Hotbar UI ----------
const hotbarEl = document.getElementById('hotbar');
const selectedLabelEl = document.getElementById('selected-label');
const slotEls = [];

for (let i = 0; i < 9; i++) {
  const slot = document.createElement('div');
  slot.className = 'hotbar-slot';
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = i + 1;
  const count = document.createElement('span');
  count.className = 'count';
  slot.appendChild(swatch);
  slot.appendChild(num);
  slot.appendChild(count);
  slot.addEventListener('click', () => selectSlot(i));
  hotbarEl.appendChild(slot);
  slotEls.push({ el: slot, swatch, count });
}

function renderHotbar() {
  hotbar.forEach((slot, i) => {
    const { swatch, count } = slotEls[i];
    if (slot.typeIndex === null) {
      swatch.style.background = 'transparent';
      swatch.style.backgroundImage = 'none';
      count.textContent = '';
    } else {
      styleSwatchFor(swatch, slot.typeIndex);
      count.textContent = gameMode === 'survival' ? String(survivalInventory.get(slot.typeIndex) || 0) : '';
    }
  });
  slotEls.forEach((s, idx) => s.el.classList.toggle('active', idx === selectedSlot));
  const slot = hotbar[selectedSlot];
  selectedLabelEl.textContent = slot && slot.typeIndex !== null ? BLOCK_TYPES[slot.typeIndex].name : 'Empty';
  updateHeldItemVisual();
}

function selectSlot(i) {
  selectedSlot = i;
  renderHotbar();
}

function fillCreativeStarterHotbar() {
  for (let i = 0; i < 9; i++) hotbar[i].typeIndex = i;
}

// ---------- Inventory panel ----------
const inventoryPanel = document.getElementById('inventory-panel');
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryTitle = document.getElementById('inventory-title');

function buildInventoryGrid() {
  inventoryGrid.innerHTML = '';
  let lastCategory = null;
  const entries = gameMode === 'creative'
    ? BLOCK_TYPES.map((b, i) => [i, b])
    : [...survivalInventory.entries()].filter(([, c]) => c > 0).map(([i]) => [i, BLOCK_TYPES[i]]);

  if (gameMode === 'survival' && entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'inv-empty';
    empty.textContent = 'Nothing collected yet — mine some blocks first.';
    inventoryGrid.appendChild(empty);
    return;
  }

  entries.forEach(([typeIndex, type]) => {
    if (gameMode === 'creative' && type.category !== lastCategory) {
      lastCategory = type.category;
      const header = document.createElement('div');
      header.className = 'inv-header';
      header.textContent = lastCategory;
      inventoryGrid.appendChild(header);
    }
    const item = document.createElement('div');
    item.className = 'inv-item';
    item.title = type.name;
    const swatch = document.createElement('div');
    swatch.className = 'inv-swatch';
    styleSwatchFor(swatch, typeIndex);
    item.appendChild(swatch);
    if (gameMode === 'survival') {
      const badge = document.createElement('span');
      badge.className = 'inv-count';
      badge.textContent = survivalInventory.get(typeIndex);
      item.appendChild(badge);
    }
    item.addEventListener('click', () => {
      hotbar[selectedSlot].typeIndex = typeIndex;
      renderHotbar();
      closeInventory();
      if (!isTouchDevice) renderer.domElement.requestPointerLock();
    });
    inventoryGrid.appendChild(item);
  });
}

function toggleInventory() {
  if (craftingOpen) return;
  if (inventoryOpen) closeInventory(); else openInventory();
}
function openInventory() {
  inventoryOpen = true;
  playUiClickSfx();
  inventoryTitle.textContent = gameMode === 'creative' ? 'Inventory — click a block to select it' : 'Your Items';
  buildInventoryGrid();
  inventoryPanel.classList.remove('hidden');
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}
function closeInventory() {
  inventoryOpen = false;
  playUiClickSfx();
  inventoryPanel.classList.add('hidden');
}
document.getElementById('inventory-close-btn').addEventListener('click', closeInventory);

// ---------- Crafting panel ----------
const craftingPanel = document.getElementById('crafting-panel');
const craftingListEl = document.getElementById('crafting-list');

function canCraft(recipe) {
  if (gameMode === 'creative') return true;
  return recipe.inputs.every((inp) => (survivalInventory.get(inp.typeIndex) || 0) >= inp.count);
}

function craftItem(recipe) {
  if (gameMode === 'survival') {
    if (!canCraft(recipe)) return false;
    recipe.inputs.forEach((inp) => {
      const remaining = (survivalInventory.get(inp.typeIndex) || 0) - inp.count;
      survivalInventory.set(inp.typeIndex, remaining);
      hotbar.forEach((s) => { if (s.typeIndex === inp.typeIndex && remaining <= 0) s.typeIndex = null; });
    });
  }
  collectItem(recipe.output.typeIndex, recipe.output.count);
  playCraftSfx();
  return true;
}

function buildCraftingList() {
  craftingListEl.innerHTML = '';
  RECIPES.forEach((recipe) => {
    const row = document.createElement('div');
    row.className = 'recipe-row';

    const out = document.createElement('div');
    out.className = 'recipe-output';
    const outSwatch = document.createElement('div');
    outSwatch.className = 'recipe-swatch';
    styleSwatchFor(outSwatch, recipe.output.typeIndex);
    out.appendChild(outSwatch);
    const outLabel = document.createElement('span');
    outLabel.textContent = `${recipe.output.name} ×${recipe.output.count}`;
    out.appendChild(outLabel);
    row.appendChild(out);

    const inputs = document.createElement('div');
    inputs.className = 'recipe-inputs';
    recipe.inputs.forEach((inp) => {
      const chip = document.createElement('span');
      chip.className = 'recipe-chip';
      const have = survivalInventory.get(inp.typeIndex) || 0;
      chip.textContent = `${inp.name} ×${inp.count} (have ${have})`;
      inputs.appendChild(chip);
    });
    row.appendChild(inputs);

    const btn = document.createElement('button');
    btn.textContent = 'Craft';
    btn.disabled = !canCraft(recipe);
    btn.addEventListener('click', () => { craftItem(recipe); buildCraftingList(); });
    row.appendChild(btn);

    craftingListEl.appendChild(row);
  });
}

function toggleCrafting() {
  if (inventoryOpen) return;
  if (gameMode === 'creative') {
    showToast('Creative mode: everything is already in your inventory (E)');
    return;
  }
  if (craftingOpen) closeCrafting(); else openCrafting();
}
function openCrafting() {
  craftingOpen = true;
  playUiClickSfx();
  buildCraftingList();
  craftingPanel.classList.remove('hidden');
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}
function closeCrafting() {
  craftingOpen = false;
  playUiClickSfx();
  craftingPanel.classList.add('hidden');
}
document.getElementById('crafting-close-btn').addEventListener('click', closeCrafting);

// ---------- Toast ----------
const toastEl = document.getElementById('toast');
let toastTimeout = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ---------- Achievements ----------
// Client-local (localStorage), same as mobs/villagers/horses — a personal trophy case scoped to
// this browser rather than a server-synced/competitive thing, so no new server round-trip for
// what's fundamentally a bit of flavor.
const ACHIEVEMENTS = [
  { id: 'first_kill', emoji: '⚔️', name: 'First Blood', desc: 'Defeat a mob' },
  { id: 'first_harvest', emoji: '🌾', name: 'Green Thumb', desc: 'Harvest a ripe crop' },
  { id: 'first_tame', emoji: '🐴', name: 'Horse Whisperer', desc: 'Tame a horse' },
  { id: 'first_trade', emoji: '🤝', name: "Villager's Friend", desc: 'Complete a trade with a villager' },
  { id: 'first_enchant', emoji: '✨', name: 'Arcane Apprentice', desc: 'Enchant a tool' },
  { id: 'full_diamond_armor', emoji: '💎', name: 'Diamond Clad', desc: 'Equip Diamond Armor' },
  { id: 'home_owner', emoji: '🚩', name: 'Home Owner', desc: 'Place a land claim' },
  { id: 'pyrotechnic', emoji: '🎆', name: 'Pyrotechnic', desc: 'Launch a firework' },
  { id: 'deep_diver', emoji: '⛏️', name: 'Deep Diver', desc: 'Dig below y = -20' },
];
const ACHIEVEMENTS_KEY = 'valk-bc-achievements';
let unlockedAchievements = new Set();
try { unlockedAchievements = new Set(JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]')); } catch { /* no-op */ }

function unlockAchievement(id) {
  if (unlockedAchievements.has(id)) return;
  unlockedAchievements.add(id);
  try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...unlockedAchievements])); } catch { /* no-op */ }
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (def) { playAchievementSfx(); showToast(`🏆 Achievement unlocked: ${def.name}`); }
}


// ---------- Minimap ----------
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');
const MINIMAP_RADIUS = 28;
const MINIMAP_SIZE = 160;
const MINIMAP_SCALE = MINIMAP_SIZE / (MINIMAP_RADIUS * 2);
let minimapVisible = true;
let lastMinimapDrawAt = 0;

function minimapDrawDot(px, pz, wx, wz, color, radius) {
  const sx = (wx - px + MINIMAP_RADIUS) * MINIMAP_SCALE;
  const sz = (wz - pz + MINIMAP_RADIUS) * MINIMAP_SCALE;
  if (sx < 0 || sx > MINIMAP_SIZE || sz < 0 || sz > MINIMAP_SIZE) return;
  minimapCtx.beginPath();
  minimapCtx.arc(sx, sz, radius, 0, Math.PI * 2);
  minimapCtx.fillStyle = color;
  minimapCtx.fill();
}

function drawMinimap() {
  if (!minimapVisible || minimapCanvas.style.display === 'none') return;
  const now = performance.now();
  if (now - lastMinimapDrawAt < 400) return;
  lastMinimapDrawAt = now;

  const ctx = minimapCtx;
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  const px = Math.round(yawObject.position.x);
  const pz = Math.round(yawObject.position.z);

  for (let dx = -MINIMAP_RADIUS; dx <= MINIMAP_RADIUS; dx++) {
    for (let dz = -MINIMAP_RADIUS; dz <= MINIMAP_RADIUS; dz++) {
      const x = px + dx, z = pz + dz;
      const topY = groundHeightAt(x, z);
      if (topY === null) continue;
      const blockType = world.get(keyOf(x, topY - 1, z));
      if (blockType === undefined) continue;
      ctx.fillStyle = '#' + blockColor(blockType).toString(16).padStart(6, '0');
      const sx = (dx + MINIMAP_RADIUS) * MINIMAP_SCALE;
      const sz = (dz + MINIMAP_RADIUS) * MINIMAP_SCALE;
      ctx.fillRect(sx, sz, MINIMAP_SCALE + 1, MINIMAP_SCALE + 1);
    }
  }

  mobs.forEach((m) => minimapDrawDot(px, pz, m.group.position.x, m.group.position.z, '#e74c3c', 3));
  villagers.forEach((v) => minimapDrawDot(px, pz, v.group.position.x, v.group.position.z, '#d1a637', 3));
  horses.forEach((h) => minimapDrawDot(px, pz, h.group.position.x, h.group.position.z, '#8a5a34', 3));
  bcRemotePlayers.forEach((rp) => minimapDrawDot(px, pz, rp.group.position.x, rp.group.position.z, rp.color || '#3b9dff', 4));

  // Player arrow at center, pointing in the direction the camera is facing.
  ctx.save();
  ctx.translate(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2);
  ctx.rotate(yawObject.rotation.y);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fillStyle = '#34e89e';
  ctx.fill();
  ctx.restore();
}

// ---------- Health, PvP punching, fall damage ----------
// Health is server-authoritative in multiplayer (bc-hit/bc-death come back from the server,
// which is the one place that decrements it) so one client can't unilaterally kill another —
// this mirrors every other minigame's "server owns shared state" pattern. In solo play (no
// bcSocket) there's no server round-trip, so damage is applied locally instead.
const BC_MAX_HEALTH = 10;
const PUNCH_RANGE = 4;
const PUNCH_HIT_RADIUS = 0.6;
const PUNCH_COOLDOWN_MS = 450;
const FALL_SAFE_DISTANCE = 3; // blocks of fall before it starts hurting, same idea as Minecraft
const MAX_FALL_DAMAGE = BC_MAX_HEALTH;
const FOOTSTEP_STEP_DISTANCE = 1.3; // world units of ground travel between footstep sounds
const REGEN_INTERVAL_MS = 4000; // +1 heart every 4s once eligible (matches the server's own regen tick)
const REGEN_DAMAGE_COOLDOWN_MS = 5000; // must go this long without damage before regen kicks in

const healthBarEl = document.getElementById('health-bar');
const damageFlashEl = document.getElementById('damage-flash');
const deathOverlayEl = document.getElementById('death-overlay');
const deathCauseEl = document.getElementById('death-cause');
const respawnBtn = document.getElementById('respawn-btn');

let myHealth = BC_MAX_HEALTH;
let isDead = false;
let lastPunchAt = 0;
let airborne = false;
let airPeakY = 0;
let lastDamageAt = 0;
let footstepAccum = 0;
let wasSwimming = false;
let nextRegenAt = 0;

for (let i = 0; i < BC_MAX_HEALTH; i++) {
  const heart = document.createElement('span');
  heart.className = 'heart';
  heart.textContent = '❤️';
  healthBarEl.appendChild(heart);
}

function renderHealth() {
  const hearts = healthBarEl.children;
  for (let i = 0; i < hearts.length; i++) {
    hearts[i].classList.toggle('empty', i >= myHealth);
  }
}
renderHealth();

function flashDamage() {
  damageFlashEl.classList.remove('show');
  void damageFlashEl.offsetWidth; // restart the CSS animation
  damageFlashEl.classList.add('show');
}

// Routes damage through the server when connected (multiplayer, single source of truth for
// health so PvP can't be spoofed client-side); falls back to a purely local health system
// when playing solo (no bcSocket at all).
function reportFallDamage(amount) {
  if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(JSON.stringify({ type: 'bc-fall-damage', amount }));
  } else {
    let dealt = amount;
    if (equippedArmorReduction && Math.random() < equippedArmorReduction) dealt = Math.max(0, dealt - 1);
    if (dealt > 0) applyHealthChange(myHealth - dealt, null);
  }
}

function applyFallDamage(distance) {
  if (isDead) return;
  const dmg = Math.floor(distance - FALL_SAFE_DISTANCE);
  if (dmg <= 0) return;
  reportFallDamage(Math.min(dmg, MAX_FALL_DAMAGE));
}

// health/killedBy come from the server in multiplayer; killedBy is a player id (or null for a
// fall) — solo mode calls this directly with killedBy always null. Floors at 1 instead of 0 in
// creative so myHealth never actually reaches 0 and die() below never fires — solo mode has no
// server to enforce this, so it has to happen here. (Multiplayer never even sends a health of 0
// for a creative player in the first place — see applyBcDamage server-side — this is just the
// matching floor for the no-server case.)
function applyHealthChange(newHealth, killedBy) {
  const minHealth = gameMode === 'creative' ? 1 : 0;
  const clamped = Math.max(minHealth, Math.min(BC_MAX_HEALTH, newHealth));
  if (clamped < myHealth) { flashDamage(); playHurtSfx(); lastDamageAt = performance.now(); }
  myHealth = clamped;
  renderHealth();
  if (myHealth <= 0 && !isDead) die(killedBy);
}

// Solo-only: multiplayer regen is server-authoritative (see bc-heal), same split as fall damage.
function updateHealthRegen() {
  if (bcMultiplayerActive) return;
  if (isDead || myHealth >= BC_MAX_HEALTH) { nextRegenAt = 0; return; }
  const now = performance.now();
  if (now - lastDamageAt < REGEN_DAMAGE_COOLDOWN_MS) { nextRegenAt = 0; return; }
  if (!nextRegenAt) { nextRegenAt = now + REGEN_INTERVAL_MS; return; }
  if (now >= nextRegenAt) {
    applyHealthChange(myHealth + 1, null);
    nextRegenAt = now + REGEN_INTERVAL_MS;
  }
}

function die(killedBy) {
  isDead = true;
  playDeathSfx();
  leftDown = false;
  rightDown = false;
  const killerName = killedBy && bcRemotePlayers.has(killedBy) ? nameForRemotePlayer(killedBy) : null;
  deathCauseEl.textContent = killerName ? `${killerName} punched you out.` : 'You took too much damage.';
  deathOverlayEl.classList.remove('hidden');
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

function respawn() {
  isDead = false;
  myHealth = BC_MAX_HEALTH;
  renderHealth();
  airborne = false;
  verticalVelocity = 0;
  if (ridingBoat) { ridingBoat = false; if (boatMesh) { yawObject.remove(boatMesh); boatMesh = null; } }
  if (ridingMinecart) { ridingMinecart = false; if (minecartMesh) { yawObject.remove(minecartMesh); minecartMesh = null; } }
  if (ridingHorse) dismountHorse();
  yawObject.position.set(0, 4, 0);
  deathOverlayEl.classList.add('hidden');
  if (!isTouchDevice) renderer.domElement.requestPointerLock();
}
respawnBtn.addEventListener('click', respawn);

function nameForRemotePlayer(id) {
  const rp = bcRemotePlayers.get(id);
  return rp ? rp.name : null;
}

// Ray-vs-player-sphere test — reused by doBreak() to decide "punch" vs "break a block" from
// the same left-click, exactly like Minecraft overloads its one attack button on whatever's
// in front of you.
function findPunchTarget(origin, dir) {
  let best = null;
  for (const [id, rp] of bcRemotePlayers) {
    const center = rp.group.position.clone();
    center.y += 0.9; // aim roughly at torso height, not their feet
    const toPlayer = center.clone().sub(origin);
    const t = toPlayer.dot(dir);
    if (t < 0 || t > PUNCH_RANGE) continue;
    const closest = origin.clone().addScaledVector(dir, t);
    if (closest.distanceTo(center) > PUNCH_HIT_RADIUS) continue;
    if (!best || t < best.t) best = { id, t };
  }
  for (const mob of mobs) {
    const center = mob.group.position.clone();
    center.y += 0.8;
    const toMob = center.clone().sub(origin);
    const t = toMob.dot(dir);
    if (t < 0 || t > PUNCH_RANGE) continue;
    const closest = origin.clone().addScaledVector(dir, t);
    if (closest.distanceTo(center) > PUNCH_HIT_RADIUS) continue;
    if (!best || t < best.t) best = { mob, t };
  }
  return best;
}

function tryPunch(targetId) {
  const now = performance.now();
  if (now - lastPunchAt < PUNCH_COOLDOWN_MS) return;
  lastPunchAt = now;
  if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(JSON.stringify({ type: 'bc-punch', targetId }));
  }
}

// ---------- Mobs ----------
// State/constants live up near ISLANDS (see there) since generateWorld() calls spawnMobs()
// synchronously in solo mode, before the rest of this file's top-level code has run — a const
// declared only down here would still be in its temporal dead zone at that point.
function groundHeightAt(x, z) {
  for (let y = 30; y > -20; y--) {
    if (world.has(keyOf(x, y, z))) return y + 1;
  }
  return null;
}

function makeMobMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0x4a8f4a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2e5c2e });
  const legGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
  [-0.13, 0.13].forEach((xOff) => {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(xOff, 0.3, 0);
    group.add(leg);
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), skin);
  torso.position.set(0, 0.9, 0);
  group.add(torso);
  const armGeo = new THREE.BoxGeometry(0.2, 0.55, 0.2);
  [-0.35, 0.35].forEach((xOff) => {
    const arm = new THREE.Mesh(armGeo, skin);
    arm.position.set(xOff, 0.9, 0);
    group.add(arm);
  });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.set(0, 1.42, 0);
  group.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  [-0.1, 0.1].forEach((xOff) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeMat);
    eye.position.set(xOff, 1.45, 0.22);
    group.add(eye);
  });
  return group;
}

function spawnOneMob() {
  const island = ISLANDS[Math.floor(rng() * ISLANDS.length)];
  if (!island) return;
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * island.landR * 0.7;
    const x = Math.round(island.cx + Math.cos(angle) * dist);
    const z = Math.round(island.cz + Math.sin(angle) * dist);
    if (Math.hypot(x, z) < SPAWN_R + 8) continue; // keep mobs off the player's spawn clearing
    const y = groundHeightAt(x, z);
    if (y === null) continue;
    const group = makeMobMesh();
    group.position.set(x + 0.5, y, z + 0.5);
    scene.add(group);
    mobs.push({ group, health: MOB_HEALTH, lastHitAt: 0, wanderTarget: null, nextWanderChangeAt: 0 });
    return;
  }
}

function spawnMobs() {
  for (const mob of mobs) scene.remove(mob.group);
  mobs.length = 0;
  for (let i = 0; i < MOB_MAX_COUNT; i++) spawnOneMob();
}

function hitMob(mob) {
  const now = performance.now();
  if (now - lastPunchAt < PUNCH_COOLDOWN_MS) return;
  lastPunchAt = now;
  mob.health -= 1;
  playHitSfx();
  mob.group.scale.setScalar(1.15);
  setTimeout(() => mob.group.scale.setScalar(1), 80);
  if (mob.health <= 0) {
    scene.remove(mob.group);
    bcDisposeAvatarGroup(mob.group);
    const idx = mobs.indexOf(mob);
    if (idx !== -1) mobs.splice(idx, 1);
    playMobDeathSfx();
    showToast('💀 Mob defeated');
    unlockAchievement('first_kill');
    setTimeout(spawnOneMob, 8000 + Math.random() * 7000); // respawn elsewhere after a breather
  }
}

function updateMobs(delta) {
  if (mobs.length === 0) return;
  const now = performance.now();
  for (const mob of mobs) {
    const toPlayerX = yawObject.position.x - mob.group.position.x;
    const toPlayerZ = yawObject.position.z - mob.group.position.z;
    const dist = Math.hypot(toPlayerX, toPlayerZ);
    let moveX = 0, moveZ = 0;
    if (!isDead && dist < MOB_DETECT_RANGE && dist > 0.01) {
      moveX = (toPlayerX / dist) * MOB_CHASE_SPEED * delta;
      moveZ = (toPlayerZ / dist) * MOB_CHASE_SPEED * delta;
      mob.group.rotation.y = Math.atan2(toPlayerX, toPlayerZ);
      if (dist < 1.3 && now - mob.lastHitAt > MOB_DAMAGE_COOLDOWN_MS) {
        mob.lastHitAt = now;
        reportFallDamage(MOB_DAMAGE); // shares the same "self-inflicted damage" path as a fall
      }
    } else {
      if (!mob.wanderTarget || now > mob.nextWanderChangeAt) {
        const angle = Math.random() * Math.PI * 2;
        mob.wanderTarget = {
          x: mob.group.position.x + Math.cos(angle) * 5,
          z: mob.group.position.z + Math.sin(angle) * 5,
        };
        mob.nextWanderChangeAt = now + 3000 + Math.random() * 3000;
      }
      const dx = mob.wanderTarget.x - mob.group.position.x;
      const dz = mob.wanderTarget.z - mob.group.position.z;
      const wanderDist = Math.hypot(dx, dz);
      if (wanderDist > 0.3) {
        moveX = (dx / wanderDist) * MOB_WANDER_SPEED * delta;
        moveZ = (dz / wanderDist) * MOB_WANDER_SPEED * delta;
        mob.group.rotation.y = Math.atan2(dx, dz);
      }
    }
    const groundY = groundHeightAt(Math.round(mob.group.position.x), Math.round(mob.group.position.z));
    mob.group.position.x += moveX;
    mob.group.position.z += moveZ;
    if (groundY !== null) mob.group.position.y += (groundY - mob.group.position.y) * Math.min(1, delta * 6);
  }
}

// ---------- Villagers (passive trading NPCs) ----------
function makeVillagerMesh() {
  const group = new THREE.Group();
  const robe = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xcd9d75 });
  const nose = new THREE.MeshLambertMaterial({ color: 0xb5824f });
  const legGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
  [-0.13, 0.13].forEach((xOff) => {
    const leg = new THREE.Mesh(legGeo, robe);
    leg.position.set(xOff, 0.3, 0);
    group.add(leg);
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), robe);
  torso.position.set(0, 0.98, 0);
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.set(0, 1.55, 0);
  group.add(head);
  const noseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.12), nose);
  noseMesh.position.set(0, 1.5, 0.24);
  group.add(noseMesh);
  return group;
}

function spawnOneVillager() {
  const island = ISLANDS[Math.floor(rng() * ISLANDS.length)];
  if (!island) return;
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * island.landR * 0.5;
    const x = Math.round(island.cx + Math.cos(angle) * dist);
    const z = Math.round(island.cz + Math.sin(angle) * dist);
    const y = groundHeightAt(x, z);
    if (y === null) continue;
    const group = makeVillagerMesh();
    group.position.set(x + 0.5, y, z + 0.5);
    scene.add(group);
    villagers.push({ group, wanderTarget: null, nextWanderChangeAt: 0 });
    return;
  }
}

function spawnVillagers() {
  for (const v of villagers) scene.remove(v.group);
  villagers.length = 0;
  for (let i = 0; i < VILLAGER_MAX_COUNT; i++) spawnOneVillager();
}

function findVillagerTarget(origin, dir) {
  let best = null;
  for (const v of villagers) {
    const center = v.group.position.clone();
    center.y += 0.8;
    const toV = center.clone().sub(origin);
    const t = toV.dot(dir);
    if (t < 0 || t > PUNCH_RANGE) continue;
    const closest = origin.clone().addScaledVector(dir, t);
    if (closest.distanceTo(center) > PUNCH_HIT_RADIUS) continue;
    if (!best || t < best.t) best = { villager: v, t };
  }
  return best;
}

const EMERALD = indexOf('Emerald');

function tradeWithVillager() {
  if (gameMode !== 'survival') {
    showToast('👳 Villagers only trade in survival mode');
    return;
  }
  const wheat = survivalInventory.get(WHEAT_ITEM) || 0;
  const emeralds = survivalInventory.get(EMERALD) || 0;
  if (wheat >= 3) {
    survivalInventory.set(WHEAT_ITEM, wheat - 3);
    collectItem(EMERALD, 1);
    playTradeSfx();
    showToast('👳 Traded 3 Wheat for 1 Emerald');
    unlockAchievement('first_trade');
  } else if (emeralds >= 3) {
    survivalInventory.set(EMERALD, emeralds - 3);
    collectItem(indexOf('Iron Ingot'), 1);
    playTradeSfx();
    showToast('👳 Traded 3 Emeralds for 1 Iron Ingot');
    unlockAchievement('first_trade');
  } else {
    showToast('👳 "Bring me 3 Wheat, or 3 Emeralds!"');
  }
}

function updateVillagers(delta) {
  if (villagers.length === 0) return;
  const now = performance.now();
  for (const v of villagers) {
    let moveX = 0, moveZ = 0;
    if (!v.wanderTarget || now > v.nextWanderChangeAt) {
      const angle = Math.random() * Math.PI * 2;
      v.wanderTarget = {
        x: v.group.position.x + Math.cos(angle) * 4,
        z: v.group.position.z + Math.sin(angle) * 4,
      };
      v.nextWanderChangeAt = now + 4000 + Math.random() * 4000;
    }
    const dx = v.wanderTarget.x - v.group.position.x;
    const dz = v.wanderTarget.z - v.group.position.z;
    const wanderDist = Math.hypot(dx, dz);
    if (wanderDist > 0.3) {
      moveX = (dx / wanderDist) * VILLAGER_WANDER_SPEED * delta;
      moveZ = (dz / wanderDist) * VILLAGER_WANDER_SPEED * delta;
      v.group.rotation.y = Math.atan2(dx, dz);
    }
    const groundY = groundHeightAt(Math.round(v.group.position.x), Math.round(v.group.position.z));
    v.group.position.x += moveX;
    v.group.position.z += moveZ;
    if (groundY !== null) v.group.position.y += (groundY - v.group.position.y) * Math.min(1, delta * 6);
  }
}

// ---------- Horses ----------
function makeHorseMesh(tamed) {
  const group = new THREE.Group();
  const coat = new THREE.MeshLambertMaterial({ color: tamed ? 0x8a5a34 : 0x6b4a2b });
  const mane = new THREE.MeshLambertMaterial({ color: 0x2e2015 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 1.1), coat);
  body.position.set(0, 1.0, 0);
  group.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), coat);
  neck.position.set(0, 1.35, -0.55);
  neck.rotation.x = -0.3;
  group.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.45), coat);
  head.position.set(0, 1.55, -0.85);
  group.add(head);
  const maneStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.6), mane);
  maneStrip.position.set(0, 1.5, -0.5);
  group.add(maneStrip);
  const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  [[-0.17, 0.4], [0.17, 0.4], [-0.17, -0.4], [0.17, -0.4]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, coat);
    leg.position.set(x, 0.375, z);
    group.add(leg);
  });
  return group;
}

function spawnOneHorse() {
  const island = ISLANDS[Math.floor(rng() * ISLANDS.length)];
  if (!island) return;
  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * island.landR * 0.6;
    const x = Math.round(island.cx + Math.cos(angle) * dist);
    const z = Math.round(island.cz + Math.sin(angle) * dist);
    const y = groundHeightAt(x, z);
    if (y === null) continue;
    const group = makeHorseMesh(false);
    group.position.set(x + 0.5, y, z + 0.5);
    scene.add(group);
    horses.push({ group, tamed: false, wanderTarget: null, nextWanderChangeAt: 0 });
    return;
  }
}

function spawnHorses() {
  for (const h of horses) scene.remove(h.group);
  horses.length = 0;
  for (let i = 0; i < HORSE_MAX_COUNT; i++) spawnOneHorse();
}

function findHorseTarget(origin, dir) {
  let best = null;
  for (const h of horses) {
    if (h === mountedHorse) continue;
    const center = h.group.position.clone();
    center.y += 0.8;
    const toH = center.clone().sub(origin);
    const t = toH.dot(dir);
    if (t < 0 || t > PUNCH_RANGE) continue;
    const closest = origin.clone().addScaledVector(dir, t);
    if (closest.distanceTo(center) > PUNCH_HIT_RADIUS) continue;
    if (!best || t < best.t) best = { horse: h, t };
  }
  return best;
}

function mountHorse(horse) {
  ridingHorse = true;
  mountedHorse = horse;
  horse.group.visible = false;
  horseMesh = makeHorseMesh(true);
  horseMesh.position.set(0, -EYE_HEIGHT + 0.05, 0);
  horseMesh.rotation.y = Math.PI;
  yawObject.add(horseMesh);
  showToast('🐴 Mounted up! (G to dismount)');
}

function dismountHorse() {
  ridingHorse = false;
  if (horseMesh) { yawObject.remove(horseMesh); bcDisposeAvatarGroup(horseMesh); horseMesh = null; }
  if (mountedHorse) {
    mountedHorse.group.position.copy(yawObject.position);
    mountedHorse.group.position.y -= EYE_HEIGHT;
    mountedHorse.group.visible = true;
  }
  mountedHorse = null;
  showToast('🐴 Dismounted');
}

// Context-sensitive: exit whichever vehicle is active, or board based on what's selected.
// Shared by the desktop G key and the touch "exit vehicle" button so both stay in sync.
function vehicleKeyAction() {
  if (ridingBoat) toggleBoat();
  else if (ridingMinecart) toggleMinecart();
  else if (ridingHorse) dismountHorse();
  else if (hotbar[selectedSlot] && hotbar[selectedSlot].typeIndex === MINECART_ITEM) toggleMinecart();
  else toggleBoat();
}

// The button only makes sense to show while actually riding something (boarding is still done
// by selecting a boat/minecart item and pressing G/interacting, same as before) — touch users
// otherwise have no keyboard for G at all, so exiting a horse/boat/minecart was impossible.
const touchDismountBtn = document.getElementById('touch-dismount');
function updateVehicleTouchButton() {
  touchDismountBtn.style.display = isTouchDevice && (ridingHorse || ridingBoat || ridingMinecart) ? 'flex' : 'none';
}
touchDismountBtn.addEventListener('click', vehicleKeyAction);

function tryInteractHorse(horse) {
  if (ridingHorse) return;
  if (horse.tamed) {
    mountHorse(horse);
  } else if (Math.random() < HORSE_TAME_CHANCE) {
    horse.tamed = true;
    showToast('🐴 You tamed a horse! Interact again to ride.');
    unlockAchievement('first_tame');
  } else {
    showToast('🐴 The horse resists — try again...');
  }
}

function updateHorses(delta) {
  if (horses.length === 0) return;
  const now = performance.now();
  for (const h of horses) {
    if (h === mountedHorse) continue;
    let moveX = 0, moveZ = 0;
    if (!h.wanderTarget || now > h.nextWanderChangeAt) {
      const angle = Math.random() * Math.PI * 2;
      h.wanderTarget = {
        x: h.group.position.x + Math.cos(angle) * 5,
        z: h.group.position.z + Math.sin(angle) * 5,
      };
      h.nextWanderChangeAt = now + 4000 + Math.random() * 5000;
    }
    const dx = h.wanderTarget.x - h.group.position.x;
    const dz = h.wanderTarget.z - h.group.position.z;
    const wanderDist = Math.hypot(dx, dz);
    if (wanderDist > 0.3) {
      moveX = (dx / wanderDist) * HORSE_WANDER_SPEED * delta;
      moveZ = (dz / wanderDist) * HORSE_WANDER_SPEED * delta;
      h.group.rotation.y = Math.atan2(dx, dz);
    }
    const groundY = groundHeightAt(Math.round(h.group.position.x), Math.round(h.group.position.z));
    h.group.position.x += moveX;
    h.group.position.z += moveZ;
    if (groundY !== null) h.group.position.y += (groundY - h.group.position.y) * Math.min(1, delta * 6);
  }
}

// ---------- Calm ambient background music: soft sine-wave chord pads generated live via Web
// Audio oscillators — no audio files, same "nothing external" approach used elsewhere in this
// app (procedural block/face textures, Geometry Wave's chiptune loop), just slow and sparse
// instead of upbeat, to match Build Craft's mood. ----------
const MUSIC_MUTE_KEY = 'buildcraft_music_muted';
const AMBIENT_NOTE_FREQS = {
  A2: 110.0, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.0,
  A3: 220.0, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
};
// Am7 - Fmaj7 - Cmaj7 - Gsus2, held as long slow pads rather than an arpeggiated pattern.
const AMBIENT_CHORDS = [
  ['A2', 'C4', 'E4', 'G4'],
  ['A2', 'C4', 'D4', 'A3'],
  ['C3', 'E3', 'G4', 'C4'],
  ['G3', 'D4', 'A4'],
];
const AMBIENT_CHORD_DUR = 7; // seconds — slow and unhurried

let musicCtx = null, musicMasterGain = null, musicFilter = null;
let musicOn = true;
try { musicOn = localStorage.getItem(MUSIC_MUTE_KEY) !== '1'; } catch { /* no-op */ }
let musicActive = false, musicChordIndex = 0, musicNextChordTime = 0;

function playPadNote(freq, startTime, duration, peakGain) {
  const osc = musicCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = musicCtx.createGain();
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.35); // slow attack
  g.gain.linearRampToValueAtTime(0, startTime + duration); // slow release, no click
  osc.connect(g);
  g.connect(musicFilter);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function scheduleAmbientChord(index, time) {
  const chord = AMBIENT_CHORDS[index % AMBIENT_CHORDS.length];
  chord.forEach((note, i) => playPadNote(AMBIENT_NOTE_FREQS[note], time, AMBIENT_CHORD_DUR * 1.1, 0.05 - i * 0.006));
  if (Math.random() < 0.4) {
    const sparkle = ['E4', 'G4', 'A4', 'C4'][Math.floor(Math.random() * 4)];
    playPadNote(AMBIENT_NOTE_FREQS[sparkle] * 2, time + Math.random() * AMBIENT_CHORD_DUR * 0.5, 2.2, 0.025);
  }
}

function startMusic() {
  if (!musicCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    musicCtx = new AudioCtx();
    musicFilter = musicCtx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 1400;
    musicMasterGain = musicCtx.createGain();
    musicMasterGain.gain.value = 0.25;
    musicFilter.connect(musicMasterGain);
    musicMasterGain.connect(musicCtx.destination);
  }
  if (musicCtx.state === 'suspended') musicCtx.resume();
  musicChordIndex = 0;
  musicNextChordTime = musicCtx.currentTime + 0.1;
  musicActive = true;
}

function tickMusic() {
  if (!musicActive || !musicCtx) return;
  while (musicNextChordTime < musicCtx.currentTime + 0.5) {
    if (musicOn) scheduleAmbientChord(musicChordIndex, musicNextChordTime);
    musicChordIndex += 1;
    musicNextChordTime += AMBIENT_CHORD_DUR;
  }
}

const musicToggleBtn = document.getElementById('music-toggle-btn');
function updateMusicBtnLabel() { musicToggleBtn.textContent = musicOn ? '🔊' : '🔇'; }
updateMusicBtnLabel();
musicToggleBtn.addEventListener('click', () => {
  musicOn = !musicOn;
  try { localStorage.setItem(MUSIC_MUTE_KEY, musicOn ? '0' : '1'); } catch { /* no-op */ }
  updateMusicBtnLabel();
});

// ---------- Sound effects — synthesized on the same musicCtx the ambient music above already
// created (lazily, from the Start-game click), same "no audio files" approach and the same
// user-gesture that satisfies the browser's autoplay policy, so these never need their own
// unlock step. Gated on the same musicOn flag/mute button as the music — one 🔊/🔇 control for
// all of Build Craft's audio rather than a second toggle nobody would notice. ----------
function sfxNoise(duration, filterFreq, gainPeak, filterType = 'lowpass') {
  if (!musicCtx || !musicOn) return;
  const bufferSize = Math.max(1, Math.ceil(musicCtx.sampleRate * duration));
  const buffer = musicCtx.createBuffer(1, bufferSize, musicCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = musicCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = musicCtx.createGain();
  const now = musicCtx.currentTime;
  gain.gain.setValueAtTime(gainPeak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(musicCtx.destination);
  noise.start(now);
  noise.stop(now + duration);
}

function sfxTone(freq, duration, gainPeak, type = 'sine', glideTo) {
  if (!musicCtx || !musicOn) return;
  const osc = musicCtx.createOscillator();
  osc.type = type;
  const now = musicCtx.currentTime;
  osc.frequency.setValueAtTime(freq, now);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + duration);
  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(gainPeak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(musicCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

// Buckets a block by name (regex over BLOCK_TYPES[i].name) rather than adding a new "material"
// field to every block definition — good enough for picking a break/place timbre, not meant to
// be exhaustive.
function materialBucket(typeIndex) {
  const name = (BLOCK_TYPES[typeIndex] && BLOCK_TYPES[typeIndex].name) || '';
  if (/Stone|Ore|Brick|Cobble|Diamond|Iron|Gold|Coal|Lapis|Obsidian|Rail/.test(name)) return 'stone';
  if (/Wood|Log|Plank|Stick|Table|Boat|Fence|Bookshelf|Furnace/.test(name)) return 'wood';
  if (/Dirt|Grass|Farmland|Sand|Path|Wheat|Crop/.test(name)) return 'dirt';
  if (/Leaves|Wool|Bed/.test(name)) return 'soft';
  return 'generic';
}
const MATERIAL_SFX = {
  stone: { freq: 1700, dur: 0.09, gain: 0.16 },
  wood: { freq: 750, dur: 0.11, gain: 0.16 },
  dirt: { freq: 320, dur: 0.13, gain: 0.16 },
  soft: { freq: 2200, dur: 0.08, gain: 0.09 },
  generic: { freq: 950, dur: 0.1, gain: 0.14 },
};

function playBreakSfx(typeIndex) {
  const p = MATERIAL_SFX[materialBucket(typeIndex)];
  sfxNoise(p.dur, p.freq, p.gain);
}
function playPlaceSfx(typeIndex) {
  const p = MATERIAL_SFX[materialBucket(typeIndex)];
  sfxNoise(p.dur * 0.85, p.freq * 0.65, p.gain * 0.85);
}

function playHitSfx() {
  sfxNoise(0.06, 500, 0.18);
  sfxTone(180, 0.07, 0.14, 'square');
}
function playMobDeathSfx() { sfxTone(320, 0.35, 0.14, 'sawtooth', 60); }
function playHurtSfx() {
  sfxTone(260, 0.16, 0.18, 'sawtooth', 110);
  sfxNoise(0.1, 700, 0.08);
}
function playDeathSfx() { sfxTone(220, 0.6, 0.16, 'sawtooth', 40); }
function playJumpSfx() { sfxTone(480, 0.12, 0.1, 'sine', 720); }
function playLandSfx() { sfxNoise(0.08, 220, 0.12); }
function playFootstepSfx() { sfxNoise(0.045, 380, 0.05); }
function playSplashSfx() {
  sfxNoise(0.22, 1400, 0.12, 'bandpass');
  sfxNoise(0.35, 500, 0.08);
}
function playCraftSfx() {
  sfxTone(660, 0.09, 0.12, 'sine');
  setTimeout(() => sfxTone(880, 0.12, 0.11, 'sine'), 70);
}
function playFishCastSfx() { sfxTone(320, 0.18, 0.09, 'sine', 160); }
function playFishCatchSfx() {
  [523, 659, 784].forEach((freq, i) => setTimeout(() => sfxTone(freq, 0.14, 0.12, 'sine'), i * 90));
}
function playFishFailSfx() { sfxTone(260, 0.2, 0.08, 'sine', 160); }
function playTradeSfx() {
  sfxTone(880, 0.07, 0.1, 'sine');
  setTimeout(() => sfxTone(1180, 0.1, 0.09, 'sine'), 60);
}
function playAchievementSfx() {
  [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => sfxTone(freq, 0.18, 0.12, 'sine'), i * 100));
}
function playUiClickSfx() { sfxTone(700, 0.03, 0.05, 'square'); }

// ---------- Player color picker ----------
const skinColorLabel = document.getElementById('skin-color-label');
const skinColorInput = document.getElementById('skin-color-input');
skinColorInput.value = myShirtColor;
skinColorInput.addEventListener('input', () => {
  myShirtColor = skinColorInput.value;
  localStorage.setItem('valk-bc-skin-color', myShirtColor);
  if (bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(JSON.stringify({ type: 'bc-set-skin', color: myShirtColor }));
  }
});

// ---------- Voice chat (multiplayer only) ----------
// Same idea as the chat page's voice calls — a mesh of RTCPeerConnections, server only relays
// signaling (offer/answer/ICE), audio flows peer-to-peer — but scoped to bc-voice-* messages on
// this page's own WebSocket, since Build Craft never has ws.profile/ws.room to piggyback the
// chat page's voice system on. Peers are keyed by bcId (the same id bc-join already assigns).
const voiceToggleBtn = document.getElementById('voice-toggle-btn');
const BC_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
let bcVoiceActive = false;
let bcVoiceStream = null;
const bcVoicePeers = new Map(); // id -> { name, pc, audioEl, pendingCandidates }

function updateVoiceBtn() {
  if (!bcVoiceActive) {
    voiceToggleBtn.textContent = '🎤';
    voiceToggleBtn.setAttribute('aria-label', 'Join voice chat');
    voiceToggleBtn.classList.remove('muted');
    return;
  }
  const track = bcVoiceStream && bcVoiceStream.getAudioTracks()[0];
  const muted = !!(track && !track.enabled);
  voiceToggleBtn.textContent = muted ? '🔇' : '🎙️';
  voiceToggleBtn.setAttribute('aria-label', muted ? 'Unmute microphone' : 'Mute microphone');
  voiceToggleBtn.classList.toggle('muted', muted);
}
updateVoiceBtn();

async function joinBcVoice() {
  if (bcVoiceActive || !bcSocket || bcSocket.readyState !== WebSocket.OPEN) return;
  try {
    bcVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast('🎤 Could not access your microphone — check your browser\'s site permissions.');
    return;
  }
  bcVoiceActive = true;
  updateVoiceBtn();
  bcSocket.send(JSON.stringify({ type: 'bc-voice-join' }));
}

function toggleBcVoiceMute() {
  const track = bcVoiceStream && bcVoiceStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  updateVoiceBtn();
}

voiceToggleBtn.addEventListener('click', () => {
  if (!bcVoiceActive) joinBcVoice();
  else toggleBcVoiceMute();
});

function makeBcVoicePeerConnection(id) {
  const pc = new RTCPeerConnection({ iceServers: BC_ICE_SERVERS });
  if (bcVoiceStream) {
    bcVoiceStream.getTracks().forEach((track) => pc.addTrack(track, bcVoiceStream));
  } else {
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }
  pc.addEventListener('icecandidate', (e) => {
    if (e.candidate) {
      bcSocket.send(JSON.stringify({ type: 'bc-voice-signal', to: id, signal: { type: 'ice', candidate: e.candidate } }));
    }
  });
  pc.addEventListener('track', (e) => {
    const peer = bcVoicePeers.get(id);
    if (!peer) return;
    if (!peer.audioEl) {
      peer.audioEl = document.createElement('audio');
      peer.audioEl.autoplay = true;
      peer.audioEl.playsInline = true;
      document.body.appendChild(peer.audioEl);
    }
    peer.audioEl.srcObject = e.streams[0];
  });
  return pc;
}

function addBcVoicePeer(id, name) {
  if (bcVoicePeers.has(id)) return;
  bcVoicePeers.set(id, { name, pc: makeBcVoicePeerConnection(id), audioEl: null, pendingCandidates: [] });
}

async function makeBcVoiceOffer(id) {
  const peer = bcVoicePeers.get(id);
  if (!peer) return;
  const offer = await peer.pc.createOffer();
  await peer.pc.setLocalDescription(offer);
  bcSocket.send(JSON.stringify({ type: 'bc-voice-signal', to: id, signal: { type: 'offer', sdp: peer.pc.localDescription } }));
}

async function handleBcVoiceSignal(from, signal) {
  let peer = bcVoicePeers.get(from);
  if (!peer && signal.type === 'offer') {
    peer = { name: '', pc: makeBcVoicePeerConnection(from), audioEl: null, pendingCandidates: [] };
    bcVoicePeers.set(from, peer);
  }
  if (!peer) return;
  if (signal.type === 'offer') {
    await peer.pc.setRemoteDescription(signal.sdp);
    for (const c of peer.pendingCandidates) await peer.pc.addIceCandidate(c);
    peer.pendingCandidates = [];
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    bcSocket.send(JSON.stringify({ type: 'bc-voice-signal', to: from, signal: { type: 'answer', sdp: peer.pc.localDescription } }));
  } else if (signal.type === 'answer') {
    await peer.pc.setRemoteDescription(signal.sdp);
  } else if (signal.type === 'ice') {
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(signal.candidate);
    else peer.pendingCandidates.push(signal.candidate);
  }
}

function removeBcVoicePeer(id) {
  const peer = bcVoicePeers.get(id);
  if (!peer) return;
  if (peer.pc) peer.pc.close();
  if (peer.audioEl) peer.audioEl.remove();
  bcVoicePeers.delete(id);
}

function resetBcVoice() {
  for (const id of [...bcVoicePeers.keys()]) removeBcVoicePeer(id);
  if (bcVoiceStream) bcVoiceStream.getTracks().forEach((t) => t.stop());
  bcVoiceStream = null;
  bcVoiceActive = false;
  updateVoiceBtn();
}

// ---------- In-game text chat (multiplayer only) ----------
// Ephemeral — not persisted anywhere (unlike the main chat's history), just a live relay among
// whoever's currently in this Build Craft session. Minecraft-style: a fading log, T to compose.
const bcChatLogEl = document.getElementById('bc-chat-log');
const bcChatForm = document.getElementById('bc-chat-form');
const bcChatInput = document.getElementById('bc-chat-input');
const BC_CHAT_LINE_LIFETIME_MS = 8000;

function addBcChatLine(name, text) {
  const line = document.createElement('div');
  line.className = 'bc-chat-line';
  const strong = document.createElement('strong');
  strong.textContent = `${name}: `;
  line.appendChild(strong);
  line.appendChild(document.createTextNode(text));
  bcChatLogEl.appendChild(line);
  while (bcChatLogEl.children.length > 8) bcChatLogEl.removeChild(bcChatLogEl.firstChild);
  setTimeout(() => line.classList.add('fade'), BC_CHAT_LINE_LIFETIME_MS);
  setTimeout(() => line.remove(), BC_CHAT_LINE_LIFETIME_MS + 700);
}

function openBcChat() {
  if (!bcMultiplayerActive) return;
  bcChatForm.classList.remove('hidden');
  bcChatInput.value = '';
  bcChatInput.focus();
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

function closeBcChat() {
  bcChatForm.classList.add('hidden');
  bcChatInput.blur();
  if (!isTouchDevice) renderer.domElement.requestPointerLock();
}

bcChatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = bcChatInput.value.trim();
  if (text && bcSocket && bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(JSON.stringify({ type: 'bc-chat', text }));
  }
  closeBcChat();
});

bcChatInput.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { e.preventDefault(); closeBcChat(); }
  e.stopPropagation(); // never let the game's own keydown handler see keys typed here
});

// ---------- Touch controls (mobile: no Pointer Lock, e.g. iOS Safari doesn't support it) ----------
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const touchControlsEl = document.getElementById('touch-controls');
let touchMoveX = 0;
let touchMoveZ = 0;

if (isTouchDevice) {
  document.getElementById('controls-list-desktop').classList.add('hidden');
  document.getElementById('controls-list-touch').classList.remove('hidden');

  // Virtual joystick: drag distance from the base's center (clamped to its radius) becomes an
  // analog move vector, read by updateMovement the same way WASD does.
  const joystickBase = document.getElementById('touch-joystick');
  const joystickKnob = document.getElementById('touch-joystick-knob');
  const JOYSTICK_RADIUS = 45;
  let joystickTouchId = null;

  function updateJoystick(t) {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) { dx = (dx / dist) * JOYSTICK_RADIUS; dy = (dy / dist) * JOYSTICK_RADIUS; }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMoveX = dx / JOYSTICK_RADIUS;
    touchMoveZ = dy / JOYSTICK_RADIUS;
  }

  function resetJoystick() {
    joystickTouchId = null;
    touchMoveX = 0;
    touchMoveZ = 0;
    joystickKnob.style.transform = 'translate(0px, 0px)';
  }

  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystickTouchId !== null) return;
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    updateJoystick(t);
  }, { passive: false });

  joystickBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joystickTouchId) updateJoystick(t);
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (t.identifier === joystickTouchId) resetJoystick();
  });
  window.addEventListener('touchcancel', (e) => {
    for (const t of e.changedTouches) if (t.identifier === joystickTouchId) resetJoystick();
  });

  // Camera look: drag anywhere on the canvas (the joystick/buttons are separate elements layered
  // on top, so touches starting on them never reach this listener). Mirrors the mousemove handler.
  const TOUCH_LOOK_SENSITIVITY = 0.0045;
  let lookTouchId = null;
  let lastLookX = 0;
  let lastLookY = 0;

  renderer.domElement.addEventListener('touchstart', (e) => {
    if (!gameStarted || inventoryOpen || craftingOpen || lookTouchId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastLookX = t.clientX;
    lastLookY = t.clientY;
  }, { passive: false });

  renderer.domElement.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      e.preventDefault();
      const dx = t.clientX - lastLookX, dy = t.clientY - lastLookY;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
      yawObject.rotation.y -= dx * TOUCH_LOOK_SENSITIVITY;
      pitchObject.rotation.x -= dy * TOUCH_LOOK_SENSITIVITY;
      pitchObject.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitchObject.rotation.x));
    }
  }, { passive: false });

  function releaseLookTouch(e) {
    for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null;
  }
  renderer.domElement.addEventListener('touchend', releaseLookTouch);
  renderer.domElement.addEventListener('touchcancel', releaseLookTouch);

  // Action buttons: hold-to-repeat for break/place (reusing the same leftDown/rightDown state the
  // desktop mouse path uses), press-to-toggle for jump/fly-down/inventory/craft.
  function bindHold(id, onDown, onUp) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); onUp(); }, { passive: false });
  }

  bindHold('touch-jump', () => { keys.Space = true; }, () => { keys.Space = false; });
  bindHold('touch-down', () => { keys.ShiftLeft = true; }, () => { keys.ShiftLeft = false; });
  bindHold('touch-break', () => { leftDown = true; lastBreakAt = performance.now(); doBreak(); }, () => { leftDown = false; });
  bindHold('touch-place', () => { rightDown = true; lastPlaceAt = performance.now(); doPlace(); }, () => { rightDown = false; });
  document.getElementById('touch-inventory').addEventListener('click', () => toggleInventory());
  document.getElementById('touch-craft').addEventListener('click', () => toggleCrafting());
}

// ---------- Start overlay / pointer lock ----------
const startOverlay = document.getElementById('start-overlay');
const crosshairEl = document.getElementById('crosshair');
const inventoryHintEl = document.getElementById('inventory-hint');

// Shows/hides the HUD (hotbar, crosshair, hint). Desktop drives this off pointerlockchange;
// touch devices call it directly since they never acquire pointer lock (iOS doesn't support it).
function setHudVisible(visible) {
  hotbarEl.style.display = visible ? 'flex' : 'none';
  selectedLabelEl.style.display = visible ? 'block' : 'none';
  crosshairEl.style.display = visible && !isTouchDevice ? 'block' : 'none';
  inventoryHintEl.style.display = visible && !isTouchDevice ? 'block' : 'none';
  touchControlsEl.classList.toggle('hidden', !(visible && isTouchDevice));
  healthBarEl.style.display = visible ? 'flex' : 'none';
  musicToggleBtn.style.display = visible ? 'block' : 'none';
  voiceToggleBtn.style.display = visible && bcMultiplayerActive ? 'block' : 'none';
  skinColorLabel.style.display = visible && bcMultiplayerActive ? 'block' : 'none';
  minimapCanvas.style.display = visible && minimapVisible ? 'block' : 'none';
}

// Fall damage in creative is already prevented client-side above (flight never counts as a
// fall) — the one remaining way a creative player could otherwise die is another player's punch,
// which is server-authoritative like all Build Craft health. Tells the server which mode this
// connection is in so it can enforce "can't die in creative" itself rather than trusting a
// client-side-only check a modified client could just skip.
function sendBcMode(mode) {
  if (!bcSocket) return;
  const payload = JSON.stringify({ type: 'bc-set-mode', gameMode: mode });
  if (bcSocket.readyState === WebSocket.OPEN) {
    bcSocket.send(payload);
  } else {
    bcSocket.addEventListener('open', () => bcSocket.send(payload), { once: true });
  }
}

function startGame(mode) {
  gameMode = mode;
  gameStarted = true;
  sendBcMode(mode);
  if (mode === 'creative') fillCreativeStarterHotbar();
  renderHotbar();
  startMusic();
  if (isTouchDevice) {
    startOverlay.classList.add('hidden');
    setHudVisible(true);
  } else {
    renderer.domElement.requestPointerLock();
  }
}

document.getElementById('start-creative-btn').addEventListener('click', () => startGame('creative'));
document.getElementById('start-survival-btn').addEventListener('click', () => startGame('survival'));

renderer.domElement.addEventListener('click', () => {
  if (isTouchDevice) return;
  if (gameStarted && !inventoryOpen && !craftingOpen && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (gameStarted) startOverlay.classList.add('hidden');
  else startOverlay.classList.toggle('hidden', locked);
  setHudVisible(locked);
  if (!locked) { leftDown = false; rightDown = false; }
});

// ---------- Render loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  const controlsActive = !isDead && (document.pointerLockElement === renderer.domElement
    || (isTouchDevice && gameStarted && !inventoryOpen && !craftingOpen));
  if (controlsActive) {
    updateMovement(delta);
    updateHeldButtons();
    updateTargetOutline();
  } else {
    targetOutline.visible = false;
  }
  updateParticles(delta);
  updateDrops(delta);
  updateClouds(delta);
  updateDayNightCycle();
  updateWeather(delta);
  updateMobs(delta);
  updateVillagers(delta);
  updateHorses(delta);
  if (isTouchDevice) updateVehicleTouchButton();
  updateFireworks(delta);
  drawMinimap();
  updateHealthRegen();
  updateCrops();
  updateFishing();
  const now = performance.now();
  waterTexture.offset.x = (now / 9000) % 1;
  waterTexture.offset.y = (now / 13000) % 1;
  if (gameStarted) updateArm(now);
  updateRemotePlayers();
  updateBcPosBroadcast(now);
  tickMusic();
  renderer.render(scene, camera);
}
animate();
