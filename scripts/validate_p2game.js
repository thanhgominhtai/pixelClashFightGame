'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const errors = [];
const warnings = [];

function check(ruleId, condition, message, isWarning = false) {
  if (!condition) {
    if (isWarning) warnings.push(`[${ruleId}] CẢNH BÁO: ${message}`);
    else errors.push(`[${ruleId}] LỖI CHẶN: ${message}`);
  }
}

function pngDimensions(file) {
  try {
    const data = fs.readFileSync(file);
    if (data.length < 24 || data.toString('ascii', 1, 4) !== 'PNG') return null;
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  } catch (_) {
    return null;
  }
}

console.log('=== [p2game-validate] Bắt đầu kiểm tra bản build dist/ ===\n');

// 1. Kiểm tra dist directory
check('ST-001', fs.existsSync(DIST_DIR), 'Thư mục dist/ chưa tồn tại. Hãy chạy npm run build:p2game trước.');
if (!fs.existsSync(DIST_DIR)) {
  console.error(errors.join('\n'));
  process.exit(1);
}

// 2. Kiểm tra manifest p2game.json
const manifestPath = path.join(DIST_DIR, 'p2game.json');
check('MF-001', fs.existsSync(manifestPath), 'Thiếu tệp p2game.json ở thư mục gốc của dist/');

let manifest = null;
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    check('MF-002', false, `p2game.json không phải JSON hợp lệ: ${err.message}`);
  }
}

if (manifest) {
  check('MF-003', manifest.schemaVersion === 1, 'schemaVersion phải bằng 1');
  const slugArgIndex = process.argv.indexOf('--slug');
  const expectedSlug = slugArgIndex !== -1 && process.argv[slugArgIndex + 1] ? process.argv[slugArgIndex + 1] : manifest.id;
  check('MF-004', typeof manifest.id === 'string' && /^[a-z0-9-]+$/.test(manifest.id) && manifest.id === expectedSlug, `manifest.id là "${manifest.id}" nhưng game này đã đăng ký với slug "${expectedSlug}".`);
  check('MF-003', typeof manifest.name === 'string' && manifest.name.length >= 2 && manifest.name.length <= 80, 'name phải dài từ 2 đến 80 ký tự');
  check('MF-005', typeof manifest.version === 'string' && /^\d+\.\d+\.\d+/.test(manifest.version), 'version phải đúng chuẩn semver (x.y.z)');
  check('MF-003', typeof manifest.description === 'string' && manifest.description.length >= 30, 'description phải có tối thiểu 30 ký tự');
  check('MF-006', typeof manifest.shortDescription === 'string' && manifest.shortDescription.length >= 10, 'shortDescription nên có từ 10-160 ký tự', true);
  check('MF-003', ['action', 'puzzle', 'arcade', 'racing', 'strategy', 'casual', 'sports', 'simulation'].includes(manifest.category), `category không hợp lệ (${manifest.category})`);
  check('MF-003', ['E', 'E10', 'T', 'M'].includes(manifest.ageRating), `ageRating không hợp lệ (${manifest.ageRating})`);
  check('MF-003', ['webgl', 'webgpu', 'canvas2d', 'dom'].includes(manifest.engine), `engine không hợp lệ (${manifest.engine})`);
  check('CP-001', manifest.attestation?.ownsRights === true, 'attestation.ownsRights bắt buộc phải là true');

  // Kiểm tra entry
  const entryFile = manifest.entry || 'index.html';
  const entryPath = path.join(DIST_DIR, entryFile);
  check('ST-001', fs.existsSync(entryPath), `Không tìm thấy tệp entry: ${entryFile}`);

  // Kiểm tra assets store
  if (manifest.assets) {
    // Icon
    const iconFile = path.join(DIST_DIR, manifest.assets.icon);
    check('AS-001', fs.existsSync(iconFile), `Thiếu tệp icon khai báo trong manifest: ${manifest.assets.icon}`);
    if (fs.existsSync(iconFile)) {
      const iconDim = pngDimensions(iconFile);
      check('AS-002', iconDim && iconDim.width === 512 && iconDim.height === 512, `Biểu tượng icon phải đúng kích thước 512×512 px (hiện tại: ${iconDim?.width}x${iconDim?.height})`);
    }

    // Cover
    const coverFile = path.join(DIST_DIR, manifest.assets.cover);
    check('AS-001', fs.existsSync(coverFile), `Thiếu tệp cover khai báo trong manifest: ${manifest.assets.cover}`);
    if (fs.existsSync(coverFile)) {
      const coverDim = pngDimensions(coverFile);
      check('AS-003', coverDim && coverDim.width >= 1280 && coverDim.height >= 720, `Ảnh cover phải tối thiểu 1280×720 px (hiện tại: ${coverDim?.width}x${coverDim?.height})`);
      if (coverDim) {
        const ratio = coverDim.width / coverDim.height;
        check('AS-003', Math.abs(ratio - (16 / 9)) < 0.01, `Ảnh cover phải đúng tỉ lệ 16:9 (hiện tại tỉ lệ: ${ratio.toFixed(3)})`);
      }
    }

    // Screenshots
    check('AS-004', Array.isArray(manifest.assets.screenshots) && manifest.assets.screenshots.length >= 1 && manifest.assets.screenshots.length <= 8, 'screenshots phải có từ 1 đến 8 ảnh');
    if (Array.isArray(manifest.assets.screenshots)) {
      manifest.assets.screenshots.forEach((shot) => {
        const shotFile = path.join(DIST_DIR, shot);
        check('AS-001', fs.existsSync(shotFile), `Thiếu ảnh screenshot: ${shot}`);
        if (fs.existsSync(shotFile)) {
          const dim = pngDimensions(shotFile);
          check('AS-004', dim && dim.width >= 960 && dim.height >= 540, `Screenshot phải tối thiểu 960×540 px (${shot} hiện tại: ${dim?.width}x${dim?.height})`);
        }
      });
    }
  }
}

// 3. Kiểm tra tệp entry index.html
const indexPath = path.join(DIST_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');

  check('HT-001', html.includes('<html') && html.includes('<body'), 'index.html thiếu thẻ <html> hoặc <body>');
  check('HT-002', html.trimStart().toLowerCase().startsWith('<!doctype html>'), 'index.html thiếu <!DOCTYPE html> ở dòng đầu tiên');
  check('HT-003', html.includes('name="viewport"'), 'index.html thiếu thẻ meta viewport');
  check('HT-008', html.includes('<title>'), 'index.html thiếu thẻ <title>', true);

  // HT-006: Kiểm tra đường dẫn tuyệt đối bắt đầu bằng '/'
  const absoluteMatches = html.match(/(src|href)=["']\/(?!\/)[^"']*["']/g);
  check('HT-006', !absoluteMatches, `index.html chứa đường dẫn tuyệt đối bắt đầu bằng '/' (vi phạm HT-006): ${absoluteMatches?.join(', ')}`);

  // HT-009: Kiểm tra có thẻ canvas nếu khai engine webgl
  check('HT-009', html.includes('<canvas'), 'Manifest khai engine "webgl" nhưng tệp khởi động không có <canvas> nào.', true);

  // HT-004: Kiểm tra nạp tài nguyên từ nguồn ngoài được phép
  const ALLOWED_CDNS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  const extScripts = html.match(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/g) || [];
  extScripts.forEach((tag) => {
    const match = tag.match(/src=["'](https?:\/\/[^"']+)["']/);
    if (match) {
      const src = match[1];
      const isAllowed = ALLOWED_CDNS.some((domain) => src.includes(domain));
      check('HT-004', isAllowed, `Tệp khởi động nạp "${src}" từ nguồn ngoài chưa được phép. Chỉ cho phép: ${ALLOWED_CDNS.join(', ')}`);
    }
  });

  // RT-002: Kiểm tra không chứa inline script (vi phạm CSP 'unsafe-inline')
  const inlineScripts = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
  check('RT-002', !inlineScripts, `index.html chứa ${inlineScripts?.length} thẻ inline script vi phạm CSP (RT-002)`);

  // SD-001: Nhúng SDK
  check('SD-001', html.includes('p2game-sdk') || html.includes('@p2game/sdk'), 'index.html chưa nhúng script p2game SDK (SD-001)');
}

// 4. Quét toàn bộ thư mục dist/ về bảo mật và kích thước
let totalBytes = 0;
let fileCount = 0;
const forbiddenExts = new Set(['.sh', '.bat', '.cmd', '.exe', '.php', '.py', '.rb']);
const forbiddenFiles = new Set(['.env', '.npmrc', 'package.json', 'package-lock.json', 'server.js']);

function scan(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      check('ST-009', entry.name !== '.git' && entry.name !== 'node_modules', `Thư mục dist/ chứa thư mục phát triển: ${entry.name}`);
      scan(full);
    } else if (entry.isFile()) {
      fileCount++;
      const size = fs.statSync(full).size;
      totalBytes += size;

      check('ST-012', size <= 200 * 1024 * 1024, `Tệp đơn lẻ vượt quá 200 MB: ${entry.name}`);
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.png' && size > 1.5 * 1024 * 1024) {
        check('PF-003', false, `Tệp PNG nặng hơn 1,5 MB (${(size / 1024 / 1024).toFixed(1)} MB): ${entry.name}`, true);
      }
      check('ST-006', !forbiddenExts.has(ext), `Tệp thực thi hoặc mã máy chủ không được phép: ${entry.name}`);
      check('ST-010', !forbiddenFiles.has(entry.name), `Tệp không được đóng gói: ${entry.name}`);
    }
  }
}

scan(DIST_DIR);

check('ST-003', fileCount <= 6000, `Tổng số tệp (${fileCount}) vượt quá hạn mức 6.000 tệp`);
check('ST-002', totalBytes <= 600 * 1024 * 1024, `Tổng dung lượng (${(totalBytes / 1024 / 1024).toFixed(2)} MB) vượt quá hạn mức 600 MB`);

// 5. Kiểm tra mã nguồn JS trong dist về các vi phạm bảo mật (SE-001 -> SE-005)
function scanJsSecurity(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanJsSecurity(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const rel = path.relative(DIST_DIR, full).replace(/\\/g, '/');
      const content = fs.readFileSync(full, 'utf8');
      check('SE-001', !/\b(window\.top|top\.location|window\.parent\.location)\b/.test(content), `${rel} chứa tham chiếu tới window.top/parent.location (vi phạm SE-001)`);
      check('SE-002', !content.includes('navigator.serviceWorker.register'), `${rel} đăng ký Service Worker (vi phạm SE-002)`);
      const hasMediaPerm = manifest?.permissions?.includes('camera') || manifest?.permissions?.includes('microphone');
      if (!hasMediaPerm) {
        check('SE-004', !content.includes('getUserMedia'), `${rel} chứa getUserMedia nhưng manifest chưa xin quyền camera/microphone (vi phạm SE-004)`);
      }
      check('SE-005', !content.includes('new Function') && !content.includes('eval('), `${rel} dùng new Function hoặc eval (vi phạm SE-005)`, true);
    }
  }
}
scanJsSecurity(DIST_DIR);

// Báo cáo kết quả
console.log('--- KẾT QUẢ KIỂM TRA ---');
console.log(`- Số tệp đã quét       : ${fileCount}`);
console.log(`- Dung lượng giải nén : ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

if (warnings.length) {
  console.log('\n[!] CẢNH BÁO:');
  warnings.forEach((w) => console.log('  ' + w));
}

if (errors.length) {
  console.log('\n[X] LỖI CHẶN XUẤT BẢN:');
  errors.forEach((e) => console.log('  ' + e));
  console.log(`\n❌ THẤT BẠI: Có ${errors.length} lỗi chặn. Cần sửa trước khi xuất bản lên p2game.`);
  process.exit(1);
} else {
  console.log('\n✅ TUYỆT VỜI: 0 LỖI CHẶN! Bản build dist/ hoàn toàn hợp lệ theo chuẩn p2game!');
  process.exit(0);
}
