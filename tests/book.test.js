import { describe, it, expect } from 'vitest';
import { fetchJsonFromDisk } from './helpers/loadBook.js';
import {
  loadBook, lampList, partChapters, partCount, plotCount, chapterTitle, pages, nextRoute, prevRoute,
  splitSentences, chapterRaw,
} from '../js/book.js';
import { PARTS, MATCH_AFTER } from '../js/config.js';

const book = await loadBook(fetchJsonFromDisk);
const { chapters } = book;

describe('loadBook', () => {
  it('讀進四份資料', () => {
    expect(book.chapters).toHaveLength(11);
    expect(Object.keys(book.glossary).length).toBeGreaterThan(0);
    for (const entry of Object.values(book.glossary)) expect(entry.note).toBeTruthy();
    expect(book.daily.items).toHaveLength(3);
    expect(book.match.pairs).toHaveLength(8);
  });
  it('讀的是 js/data/ 底下的 chapters、glossary、daily、match 四個檔', async () => {
    const asked = [];
    await loadBook(async (p) => { asked.push(p); return fetchJsonFromDisk(p); });
    expect(asked.sort()).toEqual(['js/data/chapters.json', 'js/data/daily.json', 'js/data/glossary.json', 'js/data/match.json']);
  });
  it('任何一份讀不到就整個失敗（不要半套資料）', async () => {
    for (const name of ['chapters', 'glossary', 'daily', 'match']) {
      const flaky = async (p) => { if (p.includes(name)) throw new Error('404'); return fetchJsonFromDisk(p); };
      await expect(loadBook(flaky), name).rejects.toThrow();
    }
  });
});

describe('章節查詢', () => {
  it('lampList 只在有種子的頁有（第 2、5、6、7、8、9、10 頁）', () => {
    expect(chapters.filter((c) => lampList(c)).map((c) => c.no)).toEqual([2, 5, 6, 7, 8, 9, 10]);
    expect(lampList(chapters[1]).tone).toBe('story'); // 四個典故
    expect(lampList(chapters[4]).tone).toBe('good');  // 善行
    expect(lampList(chapters[7]).tone).toBe('guard'); // 十勿
    expect(lampList(chapters[0])).toBeNull();
    expect(lampList(chapters[10])).toBeNull();
    // role 不是 lamps 的清單不算種子
    expect(lampList({ blocks: [{ type: 'list', role: 'plain-list', items: [] }] })).toBeNull();
  });
  it('partChapters：這本書一頁一段，第 n 段就是第 n 頁', () => {
    for (let part = 1; part <= 11; part += 1) {
      expect(partChapters(chapters, part).map((c) => c.no), `第 ${part} 段`).toEqual([part]);
    }
    expect(partChapters(chapters, 0)).toEqual([]);
    expect(partChapters(chapters, 12)).toEqual([]);
  });
  it('partChapters 看的是 part，不是頁次：一段分成幾頁的書也查得對（函式仍然支援）', () => {
    const tiny = [{ no: 1, part: 1 }, { no: 2, part: 2 }, { no: 3, part: 2 }, { no: 4, part: 3 }];
    expect(partChapters(tiny, 2).map((c) => c.no)).toEqual([2, 3]);
    expect(partChapters(tiny, 3).map((c) => c.no)).toEqual([4]);
    expect(partCount(tiny)).toBe(3); // 段數，不是頁數
    expect(plotCount(tiny)).toBe(4);
  });
  it('partCount 是段數（11）；plotCount 是「我的福田」的田數：一段一塊，加上「古今對照」（12）', () => {
    expect(partCount(chapters)).toBe(11);
    expect(partCount(chapters)).toBe(PARTS.length);
    expect(plotCount(chapters)).toBe(12);
  });
  it('chapterTitle：頁名就是段名，沒有（一）（二）這樣的序號', () => {
    expect(chapters.map(chapterTitle)).toEqual([
      '帝君自述', '四個典故', '心地福田', '人倫敬信', '濟急救危', '公平公益', '愛惜物命', '十勿', '修身處世', '修路造橋', '結語',
    ]);
    expect(chapters.map(chapterTitle)).toEqual(PARTS);
  });
  it('chapterTitle：資料裡有 seq 的頁（這本書沒有）才加上序號', () => {
    expect(chapterTitle({ title: '甲', seq: '二' })).toBe('甲（二）');
    expect(chapterTitle({ title: '甲' })).toBe('甲');
  });
  it('chapterRaw 是整頁原文', () => {
    expect(chapterRaw(chapters[1])).toMatch(/^於是訓於人曰：昔于公治獄，.*埋蛇，享宰相之榮。$/); // 段落＋清單
    expect(chapterRaw(chapters[6])).toMatch(/^或買物而放生，或持齋而戒殺。.*勿宰耕牛，勿棄字紙。$/); // 只有清單、沒有段落的頁
    expect(chapterRaw(chapters[10])).toMatch(/^諸惡莫作，眾善奉行。.*豈不從陰騭中得來者哉？$/); // 只有段落的頁
  });
});

describe('頁序', () => {
  it('第 1–10 頁 → 古今對照 → 第 11 頁 → 我的福田，共 13 頁', () => {
    const p = pages(chapters);
    expect(p).toHaveLength(13);
    expect(p).toEqual([
      'ch/1', 'ch/2', 'ch/3', 'ch/4', 'ch/5', 'ch/6', 'ch/7', 'ch/8', 'ch/9', 'ch/10', 'match', 'ch/11', 'land',
    ]);
  });
  it('古今對照接在第 MATCH_AFTER 頁（第 10 頁〈修路造橋〉）後面，不看頁的類型', () => {
    expect(MATCH_AFTER).toBe(10);
    expect(chapters[MATCH_AFTER - 1].title).toBe('修路造橋');
    const p = pages(chapters);
    expect(p[p.indexOf('match') - 1]).toBe(`ch/${MATCH_AFTER}`);
    // 類型怎麼寫都一樣（《太上感應篇》那本是接在最後一頁 kind: 'evil' 後面，這本不是）
    const plain = Array.from({ length: 11 }, (_, i) => ({ no: i + 1, kind: i < 3 ? 'evil' : 'text' }));
    expect(pages(plain)).toEqual(pages(chapters));
    expect(pages(plain).filter((r) => r === 'match')).toHaveLength(1);
  });
  it('nextRoute', () => {
    expect(nextRoute(chapters, '')).toBe('ch/1'); // 封面的下一頁
    expect(nextRoute(chapters, 'ch/9')).toBe('ch/10');
    expect(nextRoute(chapters, 'ch/10')).toBe('match');
    expect(nextRoute(chapters, 'match')).toBe('ch/11');
    expect(nextRoute(chapters, 'ch/11')).toBe('land');
    expect(nextRoute(chapters, 'land')).toBeNull();
    expect(nextRoute(chapters, 'daily')).toBeNull(); // 不在頁序裡
    expect(nextRoute(chapters, 'ch/12')).toBeNull(); // 沒有這一頁
  });
  it('prevRoute', () => {
    expect(prevRoute(chapters, 'ch/1')).toBe(''); // 回封面
    expect(prevRoute(chapters, 'ch/11')).toBe('match');
    expect(prevRoute(chapters, 'match')).toBe('ch/10');
    expect(prevRoute(chapters, 'land')).toBe('ch/11');
    expect(prevRoute(chapters, '')).toBeNull();
    expect(prevRoute(chapters, 'about')).toBeNull();
  });
});

describe('原文處理', () => {
  it('splitSentences 依 。！？； 斷句，去掉引號，不留空字串', () => {
    expect(splitSentences('「善哉！欲廣福田，須憑心地。豈不從陰騭中得來者哉？')).toEqual(['善哉！', '欲廣福田，須憑心地。', '豈不從陰騭中得來者哉？']);
    expect(splitSentences('勿謀人之財產；勿妒人之技能；')).toEqual(['勿謀人之財產；', '勿妒人之技能；']);
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('沒有句尾標點')).toEqual(['沒有句尾標點']);
  });
  it('每一頁的原文斷句之後再接起來，一個字都不少', () => {
    for (const ch of chapters) expect(splitSentences(chapterRaw(ch)).join(''), ch.id).toBe(chapterRaw(ch));
  });
});
