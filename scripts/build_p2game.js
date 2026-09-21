'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const ALLOWED_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.svg',
  '.wav', '.mp3', '.ogg'
]);

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', '__pycache__', '.vscode', '.idea'
]);

function copyFiltered(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  let copiedCount = 0;
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      // Skip redundant raw frames/gifs inside VFX Free Pack (game only uses 30fps/Spritesheets)
      if ((entry.name === 'Frames' || entry.name === 'Gifs' || entry.name === '60fps') && srcPath.includes('VFX Free Pack')) {
        continue;
      }
      // Skip unused VFX effect folders (e.g. Effect_Explosion which triggers PF-003 large PNG warning)
      const UNUSED_VFX_EFFECTS = new Set([
        'Effect_Explosion', 'Effect_BloodImpact', 'Effect_DitheredFire',
        'Effect_EldenRing', 'Effect_FastPixelFire', 'Effect_Kabooms',
        'Effect_Tentacles', 'Effect_Wheel', 'Effect_Worm'
      ]);
      if (UNUSED_VFX_EFFECTS.has(entry.name) && srcPath.includes('VFX Free Pack')) {
        continue;
      }
      copiedCount += copyFiltered(srcPath, destPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext)) {
        fs.copyFileSync(srcPath, destPath);
        copiedCount++;
      }
    }
  }
  return copiedCount;
}

function calculateDirStats(dir) {
  let totalBytes = 0;
  let fileCount = 0;

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile()) {
        fileCount++;
        totalBytes += fs.statSync(p).size;
      }
    }
  }

  if (fs.existsSync(dir)) walk(dir);
  return { totalBytes, fileCount };
}

console.log('=== [p2game build pipeline] Starting build ===');

// 1. Clean dist directory
if (fs.existsSync(DIST_DIR)) {
  console.log('1. Cleaning existing dist/ folder...');
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Copy static files
console.log('2. Copying public web assets...');
const publicCount = copyFiltered(path.join(ROOT_DIR, 'public'), DIST_DIR);
console.log(`   Copied ${publicCount} files from public/`);

console.log('3. Copying game assets into unified structure...');
const assetsCount = copyFiltered(path.join(ROOT_DIR, 'Character_platformer'), path.join(DIST_DIR, 'assets'));
console.log(`   Copied ${assetsCount} files to dist/assets/`);

const bgCount = copyFiltered(path.join(ROOT_DIR, 'backgound_map'), path.join(DIST_DIR, 'backgrounds'));
console.log(`   Copied ${bgCount} files to dist/backgrounds/`);

const vfxCount = copyFiltered(path.join(ROOT_DIR, 'vfx'), path.join(DIST_DIR, 'common-vfx'));
console.log(`   Copied ${vfxCount} files to dist/common-vfx/`);

const soundCount = copyFiltered(path.join(ROOT_DIR, '400 Sounds Pack'), path.join(DIST_DIR, 'sounds'));
console.log(`   Copied ${soundCount} files to dist/sounds/`);

// 4. Copy p2game.json manifest
console.log('4. Placing p2game.json in dist/ root...');
const manifestSrc = path.join(ROOT_DIR, 'p2game.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, path.join(DIST_DIR, 'p2game.json'));
} else {
  console.error('ERROR: p2game.json not found in root!');
  process.exit(1);
}

// 5. Ensure store assets exist in dist/assets/store/
const distStoreDir = path.join(DIST_DIR, 'assets', 'store');
const srcStoreDir = path.join(ROOT_DIR, 'public', 'assets', 'store');
fs.mkdirSync(distStoreDir, { recursive: true });
['icon-512.png', 'cover-1280x720.png', 'screenshot-1.png'].forEach((file) => {
  const src = path.join(srcStoreDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distStoreDir, file));
  } else {
    console.warn(`WARNING: Store asset missing: ${file}`);
  }
});

// 6. Rewrite paths in dist files for Rule HT-006 compliance (absolute '/' to relative './')
console.log('5. Normalizing absolute paths to relative "./" for HT-006 compliance...');

// In dist/index.html: Ensure relative links, local scripts, and NO query params
const indexPath = path.join(DIST_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  // Strip cache-busting query strings (?v=...) that break static servers
  indexContent = indexContent.replace(/\?v=[0-9.]+/g, '');
  // Replace any root slash paths
  indexContent = indexContent
    .replaceAll('"/favicon.svg"', '"./favicon.svg"')
    .replaceAll('"/styles.css"', '"./styles.css"')
    .replaceAll('"/styles.css', '"./styles.css')
    .replaceAll('"/shared/', '"./shared/')
    .replaceAll('"/backgrounds/', '"./backgrounds/')
    .replaceAll('"/game.js"', '"./game.js"')
    .replaceAll('"/game.js', '"./game.js');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
}

// In dist/styles.css: Ensure relative URLs for background images
const stylesPath = path.join(DIST_DIR, 'styles.css');
if (fs.existsSync(stylesPath)) {
  let stylesContent = fs.readFileSync(stylesPath, 'utf8');
  stylesContent = stylesContent
    .replaceAll('url("/backgrounds/', 'url("./backgrounds/')
    .replaceAll("url('/backgrounds/", "url('./backgrounds/")
    .replaceAll('url(/backgrounds/', 'url(./backgrounds/')
    .replaceAll('url("/assets/', 'url("./assets/')
    .replaceAll("url('/assets/", "url('./assets/")
    .replaceAll('url(/assets/', 'url(./assets/');
  fs.writeFileSync(stylesPath, stylesContent, 'utf8');
}

// In dist/shared/game-data.js: Replace absolute paths in all quote formats
const gameDataPath = path.join(DIST_DIR, 'shared', 'game-data.js');
if (fs.existsSync(gameDataPath)) {
  let content = fs.readFileSync(gameDataPath, 'utf8');
  ['assets/', 'backgrounds/', 'common-vfx/', 'sounds/', 'generated/', 'shared/'].forEach((p) => {
    content = content
      .replaceAll(`'/${p}`, `'./${p}`)
      .replaceAll(`"/${p}`, `"./${p}`)
      .replaceAll(`\`/${p}`, `\`./${p}`);
  });
  fs.writeFileSync(gameDataPath, content, 'utf8');
}

// In dist/game.js: Replace absolute paths in all quote formats (including template literals)
const gameJsPath = path.join(DIST_DIR, 'game.js');
if (fs.existsSync(gameJsPath)) {
  let content = fs.readFileSync(gameJsPath, 'utf8');
  ['assets/', 'backgrounds/', 'common-vfx/', 'sounds/', 'generated/', 'shared/'].forEach((p) => {
    content = content
      .replaceAll(`'/${p}`, `'./${p}`)
      .replaceAll(`"/${p}`, `"./${p}`)
      .replaceAll(`\`/${p}`, `\`./${p}`);
  });
  fs.writeFileSync(gameJsPath, content, 'utf8');
}

// 7. Calculate stats and verify limits
const stats = calculateDirStats(DIST_DIR);
const sizeMB = (stats.totalBytes / (1024 * 1024)).toFixed(2);
console.log('\n=== [p2game build summary] ===');
console.log(`- Output Directory   : ${DIST_DIR}`);
console.log(`- Total Files        : ${stats.fileCount} (Limit: 6,000)`);
console.log(`- Uncompressed Size  : ${sizeMB} MB (Limit: 600 MB)`);

if (stats.fileCount > 6000) {
  console.error(`ERROR: File count exceeds 6,000 limit (${stats.fileCount})!`);
  process.exit(1);
}
if (stats.totalBytes > 600 * 1024 * 1024) {
  console.error(`ERROR: Total uncompressed size exceeds 600 MB (${sizeMB} MB)!`);
  process.exit(1);
}

// 8. Create ready-to-upload zip package
const manifestData = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'p2game.json'), 'utf8'));
const slug = manifestData.id || 'pixel-clash-dojo';
console.log(`\n6. Creating upload-ready ZIP archive: dist/${slug}.zip...`);
const zipOutPath = path.join(ROOT_DIR, 'dist', `${slug}.zip`);
try {
  // Use PowerShell Compress-Archive for native, fast Windows zip creation without extra npm dependencies
  const psZipCmd = `powershell -Command "Get-ChildItem -Path '${DIST_DIR}' -Exclude '*.zip' | Compress-Archive -DestinationPath '${zipOutPath}' -Force"`;
  execSync(psZipCmd, { stdio: 'inherit' });
  const zipSizeMB = (fs.statSync(zipOutPath).size / (1024 * 1024)).toFixed(2);
  console.log(`- ZIP Archive Created: ${zipOutPath}`);
  console.log(`- ZIP Archive Size   : ${zipSizeMB} MB (Limit: 200 MB)`);
  if (fs.statSync(zipOutPath).size > 200 * 1024 * 1024) {
    console.error(`ERROR: ZIP size exceeds 200 MB limit (${zipSizeMB} MB)!`);
    process.exit(1);
  }
} catch (zipErr) {
  console.warn('Notice: Could not generate automatic zip, dist/ folder is ready for manual zip.');
}

console.log('\n>>> SUCCESS: p2game build completed successfully! <<<');
console.log('You can now run: npm run validate:p2game or upload dist/pixel-clash-dojo.zip to p2game Developer Portal.');
