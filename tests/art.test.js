import { describe, it, expect } from 'vitest';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { ART_MANIFEST, LAND_ART as MANIFEST_LAND_ART } from '../scripts/art-manifest.mjs';
import * as artPrompts from '../scripts/art-prompts.mjs';
import { LAND_ART } from '../js/config.js';
import { lampList } from '../js/book.js';
import { loadBookFromDisk } from './helpers/loadBook.js';

const { PROMPTS, PREFIX, promptFor } = artPrompts;
const { chapters } = loadBookFromDisk();
// 四個典故的插圖寫在第 2 頁清單各列的 story.art
const storyArts = chapters.flatMap((c) => (lampList(c)?.items ?? []).filter((it) => it.story).map((it) => it.story.art));

describe('插圖', () => {
  it('清單 17 張都在 assets/art/', () => {
    expect(ART_MANIFEST).toHaveLength(17);
    expect(new Set(ART_MANIFEST).size).toBe(17);
    for (const f of ART_MANIFEST) expect(existsSync(`assets/art/${f}`), f).toBe(true);
  });
  it('每一頁用的插圖都在清單裡，而且沒有兩頁共用同一張', () => {
    const used = chapters.map((c) => c.art);
    expect(used).toHaveLength(11);
    for (const f of used) expect(ART_MANIFEST, f).toContain(f);
    expect(new Set(used).size).toBe(used.length);
  });
  it('四個典故各有一張插圖（story.art），都在清單裡，彼此不重複，也不和各頁的插圖共用', () => {
    expect(storyArts).toHaveLength(4);
    for (const f of storyArts) {
      expect(ART_MANIFEST, f).toContain(f);
      expect(chapters.map((c) => c.art), f).not.toContain(f);
    }
    expect(new Set(storyArts).size).toBe(4);
  });
  it('「我的福田」的大圖：清單和 config.js 寫的是同一張，而且沒有任何一頁、任何一則故事拿它當插圖', () => {
    expect(MANIFEST_LAND_ART).toBe(LAND_ART);
    expect(LAND_ART).toBe('land-field.webp');
    expect(ART_MANIFEST).toContain(LAND_ART);
    for (const c of chapters) expect(c.art, c.id).not.toBe(LAND_ART);
    expect(storyArts).not.toContain(LAND_ART);
  });
  it('清單＝封面＋每頁一張＋「我的福田」的大圖＋四個典故各一張，沒有多的', () => {
    expect([...ART_MANIFEST].sort()).toEqual(['cover.webp', LAND_ART, ...chapters.map((c) => c.art), ...storyArts].sort());
  });
  it('清單裡每一張都有提示詞（之後才重畫得出來）', () => {
    for (const f of ART_MANIFEST) expect(PROMPTS[f.replace(/\.webp$/, '')], f).toBeTruthy();
  });
  it('完整提示詞＝畫風前綴＋場景；全書每一張都用同一段前綴', () => {
    for (const name of Object.keys(PROMPTS)) {
      expect(promptFor(name), name).toBe(PREFIX + PROMPTS[name]);
      expect(promptFor(name), name).toContain('畫中不得出現任何文字');
    }
    // 已經沒有另一套多色前綴：配色一開始就寫進共用的前綴，而且不指定單一主色
    // （《十善業道經》那本的教訓：整片綠地再配青綠主色，會整張偏綠）
    expect(Object.keys(artPrompts).filter((k) => k.startsWith('PREFIX'))).toEqual(['PREFIX']);
    expect(PREFIX).not.toContain('主色');
    expect(promptFor('沒有這張')).toBeNull();
  });
  it('assets/art/ 沒有清單以外的檔案，總體積在 4MB 內', () => {
    const files = readdirSync('assets/art');
    for (const f of files) expect(ART_MANIFEST, f).toContain(f);
    const total = files.reduce((s, f) => s + statSync(`assets/art/${f}`).size, 0);
    expect(total).toBeLessThan(4 * 1024 * 1024);
  });
  it('社群預覽圖 og.png 存在且在 500KB 內', () => {
    expect(existsSync('assets/og.png')).toBe(true);
    expect(statSync('assets/og.png').size).toBeLessThan(500 * 1024);
  });
});
