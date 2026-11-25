// art-src/<name>.png（1536×1024 原圖，不進 repo）→ assets/art/<name>.webp（1024 寬）
// 另外由封面產生社群分享預覽圖 assets/og.png（1200×630）。
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { ART_MANIFEST } from './art-manifest.mjs';

const SRC = 'art-src', OUT = 'assets/art';
mkdirSync(OUT, { recursive: true });
for (const file of ART_MANIFEST) {
  const name = file.replace(/\.webp$/, '');
  const src = `${SRC}/${name}.png`;
  if (!existsSync(src)) { console.warn(`缺原圖：${src}`); continue; }
  await sharp(src).resize({ width: 1024, height: 1024, fit: 'inside' }).webp({ quality: 66 }).toFile(`${OUT}/${file}`);
  console.log(file);
}
// palette PNG：LINE／FB 爬蟲對過重的預覽圖會直接跳過，限制調色盤把體積壓下來。
// 封面的主角（文昌帝君）在畫面上方，置中裁會切到頭頂和圓光，所以靠上裁（只留 12px 的邊）
const wide = await sharp(`${SRC}/cover.png`).resize({ width: 1200 }).toBuffer();
await sharp(wide)
  .extract({ left: 0, top: 12, width: 1200, height: 630 })
  .png({ palette: true, colours: 128, compressionLevel: 9, effort: 10 })
  .toFile('assets/og.png');
console.log('assets/og.png');
