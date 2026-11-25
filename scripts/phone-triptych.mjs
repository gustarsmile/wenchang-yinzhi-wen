// 把三張手機截圖（390×844 的畫面，2 倍截圖是 780×1688）排成一張 1200×875 的介紹圖，給部落格文章用。
// 每支手機縮到 360 寬，左上角分別在 x=30／420／810、y=48（和《十善業道經》那篇的截圖同一個版型）。
// 用法：node scripts/phone-triptych.mjs <輸出.jpg> <圖1> <圖2> <圖3>
import sharp from 'sharp';

const [out, ...files] = process.argv.slice(2);
if (files.length !== 3) { console.error('要給三張截圖'); process.exit(1); }
const W = 1200, H = 875, PW = 360, PH = 779, TOP = 48, XS = [30, 420, 810], R = 24, BORDER = 3;

// 底色：書的背景（朱紅到棗紅的放射漸層）
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="g" cx="50%" cy="0%" r="120%"><stop offset="0" stop-color="#b9573a"/><stop offset="0.45" stop-color="#6a1f15"/><stop offset="1" stop-color="#3a120c"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`);
const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}"><rect width="${PW}" height="${PH}" rx="${R}" ry="${R}" fill="#fff"/></svg>`);
const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW + BORDER * 2}" height="${PH + BORDER * 2}"><rect x="${BORDER / 2}" y="${BORDER / 2}" width="${PW + BORDER}" height="${PH + BORDER}" rx="${R + 2}" ry="${R + 2}" fill="none" stroke="#d6b256" stroke-width="${BORDER}"/></svg>`);

const layers = [];
for (let i = 0; i < 3; i += 1) {
  const screen = await sharp(files[i]).resize({ width: PW, height: PH, fit: 'cover', position: 'top' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  layers.push({ input: screen, left: XS[i], top: TOP });
  layers.push({ input: frame, left: XS[i] - BORDER, top: TOP - BORDER });
}
await sharp(bg).composite(layers).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
console.log(out);
