// Generates PWA PNG icons with no external dependencies (uses Node's zlib).
// Draws a full-bleed amber tile with a simple white wardrobe glyph.
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const AMBER = [217, 119, 6, 255]; // #d97706
const WHITE = [255, 255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = 0 (compression, filter, interlace)
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };
  const fillRect = (x0, y0, x1, y1, color) => {
    for (let y = Math.round(y0); y < Math.round(y1); y++)
      for (let x = Math.round(x0); x < Math.round(x1); x++) set(x, y, color);
  };

  // Background
  fillRect(0, 0, size, size, AMBER);

  // Wardrobe body (white)
  const bx0 = size * 0.24,
    bx1 = size * 0.76,
    by0 = size * 0.18,
    by1 = size * 0.82;
  fillRect(bx0, by0, bx1, by1, WHITE);

  // Door split (amber)
  const g = size * 0.02;
  fillRect((bx0 + bx1) / 2 - g / 2, by0, (bx0 + bx1) / 2 + g / 2, by1, AMBER);
  // Top shelf line (amber)
  fillRect(bx0, by0 + (by1 - by0) * 0.18, bx1, by0 + (by1 - by0) * 0.18 + g, AMBER);
  // Handles (amber)
  const hw = size * 0.012;
  const hy0 = by0 + (by1 - by0) * 0.45;
  const hy1 = by0 + (by1 - by0) * 0.6;
  fillRect((bx0 + bx1) / 2 - g / 2 - size * 0.04, hy0, (bx0 + bx1) / 2 - g / 2 - size * 0.04 + hw, hy1, AMBER);
  fillRect((bx0 + bx1) / 2 + g / 2 + size * 0.04 - hw, hy0, (bx0 + bx1) / 2 + g / 2 + size * 0.04, hy1, AMBER);

  return encodePng(size, px);
}

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  writeFileSync(join(OUT, name), makeIcon(size));
  console.log('wrote', name, size);
}
