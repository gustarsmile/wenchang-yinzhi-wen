// 檢查用：把幾張圖的指定區域以原尺寸裁出來拼成一張（確認畫中沒有文字）。
// 用法：node scripts/crop-check.mjs name:left:top name:left:top ...（每塊 720×480）
import sharp from 'sharp';
const W = 720, H = 480;
const specs = process.argv.slice(2).map((s) => { const [n, l, t] = s.split(':'); return { n, l: +l, t: +t }; });
const tiles = await Promise.all(specs.map((s) => sharp(`art-src/${s.n}.png`).extract({ left: s.l, top: s.t, width: W, height: H }).toBuffer()));
await sharp({ create: { width: W * 2, height: H * Math.ceil(tiles.length / 2), channels: 3, background: '#222' } })
  .composite(tiles.map((input, k) => ({ input, left: (k % 2) * W, top: Math.floor(k / 2) * H })))
  .jpeg({ quality: 80 }).toFile('art-src/_preview/crop-check.jpg');
console.log('art-src/_preview/crop-check.jpg');
