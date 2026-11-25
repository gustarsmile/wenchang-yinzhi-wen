// 從一張並排了幾個 iframe 的整頁截圖裡，把每一支「手機」裁出來（給 phone-triptych.mjs 用）。
// 用法：node scripts/crop-phones.mjs <截圖.jpg> <輸出前綴> <視窗寬> <右邊要裁掉的捲軸寬> <x,y,w,h> [<x,y,w,h> …]
//   座標是頁面上的 CSS 像素（getBoundingClientRect）；截圖的寬度和視窗寬度不同時會自動換算。
import sharp from 'sharp';

const [src, prefix, vwArg, barArg, ...rects] = process.argv.slice(2);
const meta = await sharp(src).metadata();
const k = meta.width / Number(vwArg);
const bar = Number(barArg || 0);
for (const [i, r] of rects.entries()) {
  const [x, y, w, h] = r.split(',').map(Number);
  const box = {
    left: Math.round(x * k),
    top: Math.round(y * k),
    width: Math.round((w - bar) * k),
    height: Math.min(Math.round(h * k), meta.height - Math.round(y * k)),
  };
  const out = `${prefix}-${i + 1}.png`;
  await sharp(src).extract(box).png().toFile(out);
  console.log(out, box);
}
