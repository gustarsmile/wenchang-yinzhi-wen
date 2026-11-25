// 檢查用：把幾張同尺寸的截圖橫向並排成一張。
// 用法：node scripts/tile-shots.mjs <輸出.jpg> <圖1> <圖2> ...
import sharp from 'sharp';
const [out, ...files] = process.argv.slice(2);
const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
const h = Math.max(...metas.map((m) => m.height));
let x = 0;
const tiles = files.map((input, i) => { const t = { input, left: x, top: 0 }; x += metas[i].width + 10; return t; });
await sharp({ create: { width: x - 10, height: h, channels: 3, background: '#333' } }).composite(tiles).jpeg({ quality: 82 }).toFile(out);
console.log(out);
