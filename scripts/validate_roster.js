'use strict';

const fs = require('fs');
const path = require('path');
const GAME = require('../public/shared/game-data');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REQUIRED_STATES = ['appear', 'idle', 'run', 'jump', 'fall', 'land', 'light', 'special', 'ability', 'roll', 'teleport', 'block', 'hurt', 'ko'];
const REQUIRED_MOVES = ['light', 'special', 'ability', 'ultimate'];
const SOURCE_FOLDERS = Object.freeze({
  buck: 'Buck Borris',
  rogue: 'Fantasy Rogue',
  soul_knight: '2D_SL_Knight_v1.0',
  dragon_knight: 'dragon_knight',
  iron_sentinel: 'iron_sentinel',
  dark_ninja: 'Pixel_DarkNinja_32px',
  purple_battlemage: 'PurpleGirl',
  raptor: 'raptor',
  stick_fighter: 'Stick Figure Character Sprites 2D',
  vagabond: 'vagabond'
});
const OWNED_ASSET_ROOTS = Object.freeze({
  buck: ['/assets/Buck Borris/'],
  rogue: ['/assets/Fantasy Rogue/'],
  soul_knight: ['/assets/2D_SL_Knight_v1.0/'],
  dragon_knight: ['/assets/dragon_knight/'],
  iron_sentinel: ['/assets/iron_sentinel/'],
  dark_ninja: ['/generated/characters/dark_ninja/'],
  purple_battlemage: ['/assets/PurpleGirl/'],
  raptor: ['/generated/characters/raptor/'],
  stick_fighter: ['/generated/characters/stick_fighter/'],
  vagabond: ['/generated/characters/vagabond/']
});

const errors = [];
const checkedFiles = new Set();

function fail(message) {
  errors.push(message);
}

function publicUrlToFile(url) {
  const decoded = decodeURIComponent(url).replaceAll('/', path.sep);
  if (decoded.startsWith(`${path.sep}assets${path.sep}`)) {
    return path.join(PROJECT_ROOT, 'Character_platformer', decoded.slice(`${path.sep}assets${path.sep}`.length));
  }
  if (decoded.startsWith(path.sep)) return path.join(PROJECT_ROOT, 'public', decoded.slice(1));
  return path.join(PROJECT_ROOT, 'public', decoded);
}

function pngDimensions(file) {
  const data = fs.readFileSync(file);
  if (data.length < 24 || data.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function validateSheet(characterId, state, url, spec, defaults) {
  const file = publicUrlToFile(url);
  checkedFiles.add(file);
  if (!fs.existsSync(file)) {
    fail(`${characterId}.${state}: thiếu file ${url}`);
    return;
  }
  const dimensions = pngDimensions(file);
  if (!dimensions) {
    fail(`${characterId}.${state}: runtime sheet phải là PNG (${url})`);
    return;
  }
  const frameWidth = spec.frameWidth || defaults.frameWidth;
  const frameHeight = spec.frameHeight || defaults.frameHeight;
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight) || frameWidth <= 0 || frameHeight <= 0) {
    fail(`${characterId}.${state}: frameWidth/frameHeight không hợp lệ`);
    return;
  }
  if (dimensions.width % frameWidth !== 0 || dimensions.height % frameHeight !== 0) {
    fail(`${characterId}.${state}: ${dimensions.width}x${dimensions.height} không chia hết cho frame ${frameWidth}x${frameHeight}`);
  }
  const capacity = Math.floor(dimensions.width / frameWidth) * Math.floor(dimensions.height / frameHeight);
  const indices = Array.isArray(spec.frames)
    ? spec.frames
    : Array.from({ length: spec.frames }, (_, index) => index);
  if (!indices.length || indices.some((frame) => !Number.isInteger(frame) || frame < 0 || frame >= capacity)) {
    fail(`${characterId}.${state}: chỉ số frame vượt sheet (capacity ${capacity})`);
  }
}

function readTextFiles(folder) {
  const texts = [];
  const queue = [folder];
  while (queue.length) {
    const current = queue.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
        texts.push(fs.readFileSync(fullPath, 'utf8'));
      }
    }
  }
  return texts;
}

for (const [characterId, definition] of Object.entries(GAME.CHARACTERS)) {
  if (definition.id !== characterId) fail(`${characterId}: id trong definition không khớp key`);
  if (!definition.name || !definition.archetype || !definition.color) fail(`${characterId}: thiếu metadata menu`);
  if (!/^https:\/\//.test(definition.source)) fail(`${characterId}: source phải là URL HTTPS`);

  const sourceFolderName = SOURCE_FOLDERS[characterId];
  const sourceFolder = sourceFolderName && path.join(PROJECT_ROOT, 'Character_platformer', sourceFolderName);
  if (!sourceFolder || !fs.existsSync(sourceFolder)) {
    fail(`${characterId}: thiếu folder source riêng`);
  } else {
    const sourceDocumented = readTextFiles(sourceFolder).some((text) => text.includes(definition.source));
    if (!sourceDocumented) fail(`${characterId}: URL source không có trong file .txt của chính folder`);
  }

  if (definition.portrait) {
    const portraitFile = publicUrlToFile(definition.portrait);
    checkedFiles.add(portraitFile);
    if (!fs.existsSync(portraitFile)) fail(`${characterId}: thiếu portrait ${definition.portrait}`);
  }

  const render = definition.render || {};
  if (!(render.scale > 0 && render.scale <= 5)) fail(`${characterId}: render.scale ngoài khoảng an toàn`);
  if (!(render.originX >= 0 && render.originX <= 1 && render.originY >= 0 && render.originY <= 1)) fail(`${characterId}: origin phải nằm trong 0..1`);
  if (!(definition.hurtbox?.w > 0 && definition.hurtbox?.h > 0)) fail(`${characterId}: hurtbox không hợp lệ`);

  const assets = definition.assets;
  const ownedRoots = OWNED_ASSET_ROOTS[characterId] || [];
  if (!assets || !['atlas-grid', 'separate-sheets'].includes(assets.kind)) {
    fail(`${characterId}: assets.kind không được hỗ trợ`);
    continue;
  }
  const runtimeRoot = assets.kind === 'atlas-grid' ? assets.file : assets.root;
  if (!ownedRoots.some((root) => runtimeRoot.startsWith(root))) {
    fail(`${characterId}: runtime asset vượt ngoài folder sở hữu (${runtimeRoot})`);
  }

  if (assets.kind === 'atlas-grid') {
    const atlasFile = publicUrlToFile(assets.file);
    checkedFiles.add(atlasFile);
    if (!fs.existsSync(atlasFile)) {
      fail(`${characterId}: thiếu atlas ${assets.file}`);
    } else {
      const dimensions = pngDimensions(atlasFile);
      if (!dimensions || dimensions.width % assets.frameWidth !== 0 || dimensions.height % assets.frameHeight !== 0) {
        fail(`${characterId}: kích thước atlas không khớp grid`);
      }
    }
    const dimensions = fs.existsSync(atlasFile) ? pngDimensions(atlasFile) : null;
    const capacity = dimensions
      ? Math.floor(dimensions.width / assets.frameWidth) * Math.floor(dimensions.height / assets.frameHeight)
      : 0;
    for (const state of REQUIRED_STATES) {
      if (!assets.states?.[state]) fail(`${characterId}: thiếu state ${state}`);
    }
    for (const [state, spec] of Object.entries(assets.states || {})) {
      if (!Array.isArray(spec.frames) || !spec.frames.length || spec.frames.some((frame) => frame < 0 || frame >= capacity)) {
        fail(`${characterId}.${state}: atlas frame không hợp lệ`);
      }
    }
  } else {
    for (const state of REQUIRED_STATES) {
      const spec = assets.states?.[state];
      if (!spec) fail(`${characterId}: thiếu state ${state}`);
    }
    for (const [state, spec] of Object.entries(assets.states || {})) {
      validateSheet(characterId, state, `${assets.root}${spec.file}`, spec, assets);
    }
  }

  for (const moveId of REQUIRED_MOVES) {
    const move = definition.moves?.[moveId];
    if (!move) {
      fail(`${characterId}: thiếu move ${moveId}`);
      continue;
    }
    if (!(move.startup >= 0 && move.active > 0 && move.recovery >= 0)) fail(`${characterId}.${moveId}: frame data không hợp lệ`);
    if (!(move.damage > 0 && move.chip >= 0 && move.chip < move.damage)) fail(`${characterId}.${moveId}: damage/chip không hợp lệ`);
    if (!move.hitbox || move.hitbox.w < 0 || move.hitbox.h < 0) fail(`${characterId}.${moveId}: hitbox không hợp lệ`);
  }
  const ability = definition.moves?.ability;
  if (!(ability?.projectileSpeed > 0 && ability?.projectileLife > 0 && ability?.projectileWidth > 0 && ability?.projectileHeight > 0)) {
    fail(`${characterId}.ability: phải là chiêu tầm xa đầy đủ cho phím I`);
  }
  const ultimate = definition.moves?.ultimate;
  if (!(ultimate?.hitbox?.w >= (GAME.WORLD.maxX - GAME.WORLD.minX) * .9)) fail(`${characterId}.ultimate: chưa phủ gần toàn bản đồ`);
}

if (Object.keys(GAME.CHARACTERS).length !== Object.keys(SOURCE_FOLDERS).length) {
  fail('Roster và bảng ownership/source chưa đồng bộ');
}

if (errors.length) {
  console.error(`Roster validation thất bại (${errors.length} lỗi):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Roster OK: ${Object.keys(GAME.CHARACTERS).length} nhân vật, ${checkedFiles.size} runtime assets, không trộn folder.`);
}
