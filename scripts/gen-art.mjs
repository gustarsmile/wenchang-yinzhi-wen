// 用 draw 技能（gpt-image-2）依 art-prompts.mjs 生圖。
// 用法：node scripts/gen-art.mjs            → 補齊 art-src/ 裡還沒有的圖
//       node scripts/gen-art.mjs c04-good-deeds land-fortune → 只重畫指定的圖
// 原圖留在 art-src/_raw/<name>_<時間>.png，最新的一張複製成 art-src/<name>.png。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PROMPTS, promptFor } from './art-prompts.mjs';

// draw 技能的位置：預設在使用者家目錄的 .claude/skills/draw/，也可以用環境變數 DRAW_PY 指定
const DRAW_PY = process.env.DRAW_PY || join(homedir(), '.claude', 'skills', 'draw', 'draw.py');
const RAW = 'art-src/_raw';
mkdirSync(RAW, { recursive: true });

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(PROMPTS).filter((n) => !existsSync(`art-src/${n}.png`));

for (const name of names) {
  const prompt = promptFor(name); // 畫風前綴＋場景
  if (!prompt) { console.error(`沒有這張圖的提示詞：${name}`); process.exitCode = 1; continue; }
  console.log(`▶ ${name}`);
  const r = spawnSync('python', [DRAW_PY, prompt, '--size', '1536x1024', '--quality', 'low', '--name', name, '--outdir', RAW], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`✗ ${name} 生圖失敗`); process.exitCode = 1; continue; }
  const latest = readdirSync(RAW).filter((f) => f.startsWith(`${name}_`) && f.endsWith('.png')).sort().pop();
  if (latest) { copyFileSync(`${RAW}/${latest}`, `art-src/${name}.png`); console.log(`✓ art-src/${name}.png ← ${latest}`); }
}
