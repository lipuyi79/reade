// build.js - 打包扩展为 Chrome / Firefox 两份 .zip
// 用法（Windows / Mac / Linux 通用）：
//   node build.js
// 输出：dist/chrome.zip、dist/firefox.zip
// 零依赖，仅用 Node 内置模块

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// 要打包进 zip 的文件（相对于项目根）
const FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'popup.html',
  'popup.css',
  'popup.js',
  'options.html',
  'options.css',
  'options.js',
  'firebase.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

// ---------- 工具：CRC32 / 写最小 zip（不压缩，stored） ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function buildZip(entries) {
  // entries: [{ name: 'manifest.json', data: Buffer, deflate: true }]
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, date } = dosTime();

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf-8');
    const crc = crc32(e.data);
    const useDeflate = !!e.deflate && e.data.length > 64;
    const compressed = useDeflate ? zlib.deflateRawSync(e.data) : e.data;
    const method = useDeflate ? 8 : 0;
    const size = e.data.length;
    const csize = compressed.length;

    // local file header
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version
    local.writeUInt16LE(0x0800, 6);      // flags: utf-8 name
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(csize, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuf, compressed);

    // central directory entry
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(csize, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const localAll = Buffer.concat(localParts);
  const centralAll = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralAll.length, 12);
  eocd.writeUInt32LE(localAll.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localAll, centralAll, eocd]);
}

// ---------- 主流程 ----------
function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel));
}

function buildEntries(replacements = {}) {
  // replacements: { 'manifest.json': Buffer }
  return FILES.map((name) => {
    const data = replacements[name] || readFile(name);
    const deflate = !/\.(png|jpg|jpeg|gif|woff2?|ttf)$/i.test(name);
    return { name, data, deflate };
  });
}

function writeOut(name, buf) {
  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, name);
  fs.writeFileSync(out, buf);
  console.log(`✓ ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}

// 检查必备文件
for (const f of FILES) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.error(`✗ 缺少文件：${f}`);
    process.exit(1);
  }
}

// 1) Chrome 版 — 直接用现有 manifest.json
const chromeEntries = buildEntries();
writeOut('chrome.zip', buildZip(chromeEntries));

// 2) Firefox 版 — 用 manifest_firefox.json 替换 manifest.json
const firefoxManifestPath = path.join(ROOT, 'manifest_firefox.json');
if (fs.existsSync(firefoxManifestPath)) {
  const ffManifest = fs.readFileSync(firefoxManifestPath);
  const firefoxEntries = buildEntries({ 'manifest.json': ffManifest });
  writeOut('firefox.zip', buildZip(firefoxEntries));
} else {
  console.warn('• 未找到 manifest_firefox.json，跳过 Firefox 包');
}

console.log('\n打包完成。提交时使用：');
console.log('  Chrome Web Store / Edge Add-ons → dist/chrome.zip');
console.log('  Firefox Add-ons (AMO)            → dist/firefox.zip');
