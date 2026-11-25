// 把 art-src/*.png 每四張拼成一張對照表（2×2），放在 art-src/_preview/，方便一次過目。
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';
const OUT = 'art-src/_preview';
mkdirSync(OUT, { recursive: true });
const W = 720, H = 480;
const only = process.argv.slice(2);
const names = (only.length ? only : readdirSync('art-src').filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''))).sort();
for (let i = 0; i < names.length; i += 4) {
  const group = names.slice(i, i + 4);
  const tiles = await Promise.all(group.map((n) => sharp(`art-src/${n}.png`).resize(W, H, { fit: 'cover' }).toBuffer()));
  const sheet = sharp({ create: { width: W * 2, height: H * 2, channels: 3, background: '#222' } })
    .composite(tiles.map((input, k) => ({ input, left: (k % 2) * W, top: Math.floor(k / 2) * H })));
  const file = `${OUT}/sheet-${String(i / 4 + 1).padStart(2, '0')}.jpg`;
  await sheet.jpeg({ quality: 78 }).toFile(file);
  console.log(file, '←', group.join(', '));
}
