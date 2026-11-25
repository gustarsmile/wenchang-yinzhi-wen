// 檢查用：把一張很長的整頁截圖切成幾欄並排，方便一次看完。
// 用法：node scripts/split-shot.mjs <輸入.jpg> <輸出.jpg> [欄數=3]
import sharp from 'sharp';
const [src, out, colsArg] = process.argv.slice(2);
const cols = Number(colsArg || 3);
const meta = await sharp(src).metadata();
const h = Math.ceil(meta.height / cols);
const tiles = [];
for (let i = 0; i < cols; i += 1) {
  const top = i * h;
  const height = Math.min(h, meta.height - top);
  if (height <= 0) break;
  tiles.push({ input: await sharp(src).extract({ left: 0, top, width: meta.width, height }).toBuffer(), left: i * (meta.width + 12), top: 0 });
}
await sharp({ create: { width: cols * (meta.width + 12) - 12, height: h, channels: 3, background: '#333' } })
  .composite(tiles).jpeg({ quality: 82 }).toFile(out);
console.log(out, `${meta.width}x${meta.height} → ${cols} 欄`);
