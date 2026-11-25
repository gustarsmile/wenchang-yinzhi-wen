// 把 art-src/_raw 的原圖縮成小張預覽（給人過目用，不進 repo）
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';
const SRC = 'art-src/_raw', OUT = 'art-src/_preview';
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
for (const f of readdirSync(SRC).filter((n) => n.endsWith('.png') && (!only || n.startsWith(only)))) {
  const out = `${OUT}/${f.replace(/\.png$/, '.jpg')}`;
  await sharp(`${SRC}/${f}`).resize({ width: 900 }).jpeg({ quality: 72 }).toFile(out);
  console.log(out);
}
