import { describe, it, expect } from 'vitest';
import { loadBookFromDisk, memoryStorage, brokenStorage } from './helpers/loadBook.js';
import { createStore } from '../js/state.js';
import { lampList, plotCount } from '../js/book.js';
import { SAVE_KEY, TOTAL_LAMPS } from '../js/config.js';

// 種子在程式裡沿用《太上感應篇》那本的名字（lamps、lightLamp、isLit），畫面上一律稱「種子」
const { chapters } = loadBookFromDisk();
const ch1 = chapters[0]; // 沒有種子的頁
const ch5 = chapters[4]; // 〈濟急救危〉12 顆
const lightAll = (s, ch) => lampList(ch).items.forEach((_, i) => s.lightLamp(ch.id, i));

describe('種子', () => {
  it('種下一顆：第一次回 true，重複點回 false，只算一顆', () => {
    const s = createStore(memoryStorage());
    expect(s.lightLamp('ch05', 0)).toBe(true);
    expect(s.lightLamp('ch05', 0)).toBe(false);
    expect(s.isLit('ch05', 0)).toBe(true);
    expect(s.isLit('ch05', 1)).toBe(false);
    expect(s.litCount('ch05')).toBe(1);
    expect(s.totalLit()).toBe(1);
  });
  it('各頁分開計數，總數加總', () => {
    const s = createStore(memoryStorage());
    s.lightLamp('ch05', 0); s.lightLamp('ch05', 5); s.lightLamp('ch06', 2);
    expect(s.litCount('ch05')).toBe(2);
    expect(s.litCount('ch06')).toBe(1);
    expect(s.litCount('ch07')).toBe(0);
    expect(s.totalLit()).toBe(3);
  });
  it('有種子的頁：種子全部種下才算讀完，光是翻到過不算', () => {
    const s = createStore(memoryStorage());
    expect(lampList(ch5).items).toHaveLength(12);
    for (let i = 0; i < 11; i += 1) s.lightLamp('ch05', i);
    s.markSeen('ch05');
    expect(s.isChapterComplete(ch5)).toBe(false);
    expect(s.completedParts(chapters)).toEqual([]);
    s.lightLamp('ch05', 11);
    expect(s.isChapterComplete(ch5)).toBe(true);
    expect(s.completedParts(chapters)).toEqual([5]);
  });
  it('沒有種子的頁：翻到過（markSeen）就算讀完；還沒翻到的不算', () => {
    const s = createStore(memoryStorage());
    expect(s.isChapterComplete(ch1)).toBe(false);
    expect(s.completedParts(chapters)).toEqual([]);
    s.markSeen('ch01');
    expect(s.isChapterComplete(ch1)).toBe(true);
    expect(s.isPartComplete(chapters, 1)).toBe(true);
    expect(s.completedParts(chapters)).toEqual([1]);
  });
  it('這本書一頁一段：一頁讀完，那一段就讀完', () => {
    const s = createStore(memoryStorage());
    for (const ch of chapters) {
      expect(s.isPartComplete(chapters, ch.part), ch.id).toBe(false);
      if (lampList(ch)) lightAll(s, ch); else s.markSeen(ch.id);
      expect(s.isChapterComplete(ch), ch.id).toBe(true);
      expect(s.isPartComplete(chapters, ch.part), ch.id).toBe(true);
    }
  });
  it('一段分成幾頁的書（這本沒有，函式仍然支援）：每一頁都讀完，那一段才算讀完', () => {
    const list = (n) => ({ type: 'list', role: 'lamps', items: Array.from({ length: n }, () => ({ raw: '句', plain: '白話' })) });
    const tiny = [
      { id: 'a', no: 1, part: 1, blocks: [list(2)] },
      { id: 'b', no: 2, part: 1, blocks: [list(1)] },
      { id: 'c', no: 3, part: 2, blocks: [{ type: 'passage', raw: '句', plain: '白話' }] },
    ];
    const s = createStore(memoryStorage());
    lightAll(s, tiny[0]);
    expect(s.isChapterComplete(tiny[0])).toBe(true); // 第 1 頁自己是讀完了
    expect(s.isPartComplete(tiny, 1)).toBe(false);
    expect(s.completedParts(tiny)).toEqual([]);
    expect(s.plotsDone(tiny)).toBe(0);
    lightAll(s, tiny[1]);
    expect(s.isPartComplete(tiny, 1)).toBe(true);
    expect(s.completedParts(tiny)).toEqual([1]);
    expect(s.plotsDone(tiny)).toBe(1);
  });
  it('全書的種子都種下時，總數是 60；再把沒有種子的頁都讀過，十一段全部讀完', () => {
    const s = createStore(memoryStorage());
    for (const ch of chapters.filter((c) => lampList(c))) lightAll(s, ch);
    expect(s.totalLit()).toBe(TOTAL_LAMPS);
    expect(s.totalLit()).toBe(60);
    expect(s.completedParts(chapters)).toEqual([2, 5, 6, 7, 8, 9, 10]);
    for (const ch of chapters.filter((c) => !lampList(c))) s.markSeen(ch.id);
    expect(s.completedParts(chapters)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it('不存在的段不會被算成讀完', () => {
    const s = createStore(memoryStorage());
    for (const ch of chapters) s.markSeen(ch.id);
    expect(s.isPartComplete(chapters, 0)).toBe(false);
    expect(s.isPartComplete(chapters, 12)).toBe(false);
  });
});

describe('「我的福田」開了幾塊田 plotsDone()', () => {
  it('讀完一段開一塊；有種子的段要全部種下才算', () => {
    const s = createStore(memoryStorage());
    expect(s.plotsDone(chapters)).toBe(0);
    s.markSeen('ch01');
    expect(s.plotsDone(chapters)).toBe(1);
    s.markSeen('ch05'); // 有種子的頁，光是翻到過不算
    for (let i = 0; i < 11; i += 1) s.lightLamp('ch05', i);
    expect(s.plotsDone(chapters)).toBe(1);
    s.lightLamp('ch05', 11);
    expect(s.plotsDone(chapters)).toBe(2);
  });
  it('「古今對照」配對完成也開一塊（它不屬於任何一段，completedParts 裡沒有它）', () => {
    const s = createStore(memoryStorage());
    s.setMatchDone();
    expect(s.plotsDone(chapters)).toBe(1);
    expect(s.completedParts(chapters)).toEqual([]);
    s.markSeen('ch03');
    expect(s.plotsDone(chapters)).toBe(2);
    expect(s.completedParts(chapters)).toEqual([3]);
  });
  it('十一段都讀完還差一塊；加上「古今對照」才是十二塊全開（和 book.js 的 plotCount 一致）', () => {
    const s = createStore(memoryStorage());
    for (const ch of chapters) { if (lampList(ch)) lightAll(s, ch); else s.markSeen(ch.id); }
    expect(s.plotsDone(chapters)).toBe(11);
    s.setMatchDone();
    expect(s.plotsDone(chapters)).toBe(12);
    expect(s.plotsDone(chapters)).toBe(plotCount(chapters));
  });
  it('清除進度之後歸零', () => {
    const s = createStore(memoryStorage());
    s.markSeen('ch01'); s.setMatchDone();
    expect(s.plotsDone(chapters)).toBe(2);
    s.reset();
    expect(s.plotsDone(chapters)).toBe(0);
  });
});

describe('其他進度', () => {
  it('已讀、情境題、配對、上次位置', () => {
    const s = createStore(memoryStorage());
    expect(s.isSeen('ch01')).toBe(false);
    s.markSeen('ch01'); s.markSeen('ch01');
    expect(s.isSeen('ch01')).toBe(true);

    expect(s.getScenario('ch03')).toBeNull();
    s.setScenario('ch03', 0);
    expect(s.getScenario('ch03')).toBe(0); // 0 是有效答案，不能被當成沒答
    s.setScenario('ch03', 2);
    expect(s.getScenario('ch03')).toBe(2);

    expect(s.isMatchDone()).toBe(false);
    s.setMatchDone();
    expect(s.isMatchDone()).toBe(true);

    expect(s.getLast()).toBe('');
    s.setLast('ch/5');
    expect(s.getLast()).toBe('ch/5');
  });
});

describe('保存', () => {
  it('重建 store 之後資料還在', () => {
    const storage = memoryStorage();
    const a = createStore(storage);
    a.lightLamp('ch05', 3); a.markSeen('ch02'); a.setScenario('ch05', 1); a.setMatchDone(); a.setLast('ch/5');
    const b = createStore(storage);
    expect(b.isLit('ch05', 3)).toBe(true);
    expect(b.isSeen('ch02')).toBe(true);
    expect(b.getScenario('ch05')).toBe(1);
    expect(b.isMatchDone()).toBe(true);
    expect(b.getLast()).toBe('ch/5');
  });
  it('存在 yinzhiBook.v1 這個鍵，種子記在 lamps 欄位（書上線之後不能再改，改了讀者的進度就讀不回來）', () => {
    const storage = memoryStorage();
    const s = createStore(storage);
    s.lightLamp('ch05', 3); s.markSeen('ch02'); s.setScenario('ch05', 1); s.setLast('ch/5');
    expect(SAVE_KEY).toBe('yinzhiBook.v1');
    expect(JSON.parse(storage.getItem('yinzhiBook.v1'))).toEqual({
      v: 1, lamps: { ch05: [3] }, seen: ['ch02'], scenario: { ch05: 1 }, match: false, last: 'ch/5',
    });
  });
  it('不會去讀《太上感應篇》那本的存檔（兩本書在同一個網域底下，各存各的）', () => {
    const other = JSON.stringify({ v: 1, lamps: { ch05: [0, 1, 2] }, seen: ['ch01'], scenario: {}, match: true, last: 'ch/9' });
    const s = createStore(memoryStorage({ 'ganyingBook.v1': other }));
    expect(s.totalLit()).toBe(0);
    expect(s.isMatchDone()).toBe(false);
    expect(s.getLast()).toBe('');
  });
  it('reset 清空並移除存檔', () => {
    const storage = memoryStorage();
    const s = createStore(storage);
    s.lightLamp('ch05', 0);
    s.reset();
    expect(s.totalLit()).toBe(0);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(createStore(storage).totalLit()).toBe(0);
  });
});

describe('存檔出問題時不當機', () => {
  it('storage 一碰就丟例外：功能照常，只是不保存', () => {
    const s = createStore(brokenStorage());
    expect(s.lightLamp('ch05', 0)).toBe(true);
    expect(s.litCount('ch05')).toBe(1);
    expect(() => s.reset()).not.toThrow();
  });
  it('沒有 storage（傳 null）也能用', () => {
    const s = createStore(null);
    s.setLast('ch/2');
    expect(s.getLast()).toBe('ch/2');
  });
  it.each([
    ['亂碼', '{not json'],
    ['舊版號', JSON.stringify({ v: 0, lamps: { ch05: [0, 1] } })],
    ['不是物件', '"hello"'],
    ['null', 'null'],
    ['欄位型別不對', JSON.stringify({ v: 1, lamps: 'x', seen: 5, scenario: [], match: 'yes', last: 42 })],
    ['別本書的欄位（pearls）', JSON.stringify({ v: 1, pearls: { ch05: [0, 1] }, seen: [], scenario: {}, match: false, last: '' })],
  ])('存檔內容是%s → 當成沒有存檔', (_, raw) => {
    const s = createStore(memoryStorage({ [SAVE_KEY]: raw }));
    expect(s.totalLit()).toBe(0);
    expect(s.getLast()).toBe('');
    expect(s.isMatchDone()).toBe(false);
    expect(s.plotsDone(chapters)).toBe(0);
    expect(s.lightLamp('ch05', 0)).toBe(true);
  });
  it('存檔裡的種子索引不合理（負數、小數、字串、重複）會被丟掉', () => {
    const raw = JSON.stringify({ v: 1, lamps: { ch05: [0, 0, -1, 1.5, '2', 3] }, seen: [], scenario: {}, match: false, last: '' });
    const s = createStore(memoryStorage({ [SAVE_KEY]: raw }));
    expect(s.litCount('ch05')).toBe(2); // 只留 0 和 3
  });
});

describe('同時開兩個分頁（共用同一份存檔）', () => {
  it('兩邊各自種種子，不會互相蓋掉', () => {
    const storage = memoryStorage();
    const a = createStore(storage);
    const b = createStore(storage);
    for (let i = 0; i < 8; i += 1) b.lightLamp('ch06', i);
    a.lightLamp('ch05', 0); // a 的記憶體裡還沒有 b 的進度
    expect(createStore(storage).totalLit()).toBe(9);
    expect(a.totalLit()).toBe(9);
  });
  it('已讀、情境題、配對、上次位置也一樣不互蓋', () => {
    const storage = memoryStorage();
    const a = createStore(storage);
    const b = createStore(storage);
    b.markSeen('ch05'); b.setScenario('ch05', 2); b.setMatchDone();
    a.markSeen('ch03'); a.setScenario('ch03', 1); a.setLast('ch/3');
    const fresh = createStore(storage);
    expect(fresh.isSeen('ch05') && fresh.isSeen('ch03')).toBe(true);
    expect(fresh.getScenario('ch05')).toBe(2);
    expect(fresh.getScenario('ch03')).toBe(1);
    expect(fresh.isMatchDone()).toBe(true);
    expect(fresh.getLast()).toBe('ch/3');
  });
  it('refresh() 之後看得到另一個分頁的進度', () => {
    const storage = memoryStorage();
    const a = createStore(storage);
    createStore(storage).lightLamp('ch06', 3);
    expect(a.totalLit()).toBe(0);
    a.refresh();
    expect(a.isLit('ch06', 3)).toBe(true);
  });
  it('另一個分頁清除進度後，這邊 refresh 也跟著清空', () => {
    const storage = memoryStorage();
    const a = createStore(storage);
    a.lightLamp('ch05', 0);
    createStore(storage).reset();
    a.refresh();
    expect(a.totalLit()).toBe(0);
  });
  it('這一顆在另一個分頁已經種下：這邊再點回 false（不重複計數）', () => {
    const storage = memoryStorage();
    const a = createStore(storage);
    createStore(storage).lightLamp('ch05', 0);
    expect(a.lightLamp('ch05', 0)).toBe(false);
    expect(a.litCount('ch05')).toBe(1);
  });
});

describe('存不進去的時候', () => {
  it('寫入失敗（容量滿了）：之後的操作不會被 storage 裡的舊資料蓋掉', () => {
    const old = JSON.stringify({ v: 1, lamps: { ch05: [0] }, seen: [], scenario: {}, match: false, last: '' });
    const storage = { getItem: () => old, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    const s = createStore(storage);
    expect(s.totalLit()).toBe(1);
    s.lightLamp('ch05', 1);
    s.lightLamp('ch05', 2);
    expect(s.litCount('ch05')).toBe(3); // 沒有因為重讀舊存檔而掉回 1 或 2
    s.refresh();
    expect(s.litCount('ch05')).toBe(3);
  });
  it('讀得到但一直丟例外的 storage：refresh 不會清掉記憶體裡的進度', () => {
    const s = createStore(brokenStorage());
    s.lightLamp('ch05', 0);
    s.refresh();
    expect(s.totalLit()).toBe(1);
  });
});
