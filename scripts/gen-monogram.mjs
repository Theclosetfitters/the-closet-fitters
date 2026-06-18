// Generates the CF-monogram PWA icons (Cosmos tile, cream serif "CF").
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1F333A"/>
  <text x="50%" y="53%" dominant-baseline="central" text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700" fill="#EAE0D5">CF</text>
</svg>`;

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log('wrote', name, size);
}
