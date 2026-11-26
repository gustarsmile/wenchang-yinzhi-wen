import { describe, it, expect } from 'vitest';
import { memoryStorage, brokenStorage } from './helpers/loadBook.js';
import { dateKey, createDaily } from '../js/daily.js';
import { DAILY_KEY } from '../js/config.js';

// 可以往後撥的時鐘
function clock(y, m, d, h = 12) {
  let t = new Date(y, m - 1, d, h, 0, 0);
  const now = () => new Date(t);
  now.addDays = (n) => { t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n, h, 0, 0); };
  now.set = (date) => { t = date; };
  return now;
}

describe('dateKey 用本地日期', () => {
  it('午夜前後各算各的一天', () => {
    expect(dateKey(new Date(2026, 10, 18, 23, 59, 59))).toBe('2026-11-18');
    expect(dateKey(new Date(2026, 10, 19, 0, 0, 1))).toBe('2026-11-19');
  });
  it('月、日補零', () => {
    expect(dateKey(new Date(2027, 0, 5, 8))).toBe('2027-01-05');
  });
});

describe('每日種福', () => {
  it('一開始三項都沒勾', () => {
    const d = createDaily(memoryStorage(), clock(2026, 11, 18));
    expect(d.today()).toEqual([false, false, false]);
    expect(d.countToday()).toBe(0);
  });
  it('toggle 打勾、再點取消', () => {
    const d = createDaily(memoryStorage(), clock(2026, 11, 18));
    expect(d.toggle(0)).toBe(true);
    expect(d.toggle(2)).toBe(true);
    expect(d.countToday()).toBe(2);
    expect(d.toggle(0)).toBe(false);
    expect(d.countToday()).toBe(1);
    expect(d.today()[2]).toBe(true);
  });
  it('超出範圍的項目不理會（只有三項，沒有第四項）', () => {
    const d = createDaily(memoryStorage(), clock(2026, 11, 18));
    expect(d.toggle(3)).toBe(false);
    expect(d.toggle(9)).toBe(false);
    expect(d.toggle(-1)).toBe(false);
    expect(d.countToday()).toBe(0);
  });
  it('換一天：今天重新開始，昨天的紀錄還在', () => {
    const now = clock(2026, 11, 18);
    const d = createDaily(memoryStorage(), now);
    d.toggle(0); d.toggle(1); d.toggle(2);
    now.addDays(1);
    expect(d.countToday()).toBe(0);
    const h = d.history(7);
    expect(h).toHaveLength(7);
    expect(h.at(-1)).toEqual({ key: '2026-11-19', count: null });
    expect(h.at(-2)).toEqual({ key: '2026-11-18', count: 3 });
    expect(h[0]).toEqual({ key: '2026-11-13', count: null });
  });
  it('開著網頁跨過午夜：勾的是新的一天', () => {
    const now = clock(2026, 11, 18, 23);
    const d = createDaily(memoryStorage(), now);
    d.toggle(0);
    now.set(new Date(2026, 10, 19, 0, 5));
    d.toggle(1);
    expect(d.today()).toEqual([false, true, false]);
    expect(d.history(2)).toEqual([{ key: '2026-11-18', count: 1 }, { key: '2026-11-19', count: 1 }]);
  });
  it('重建之後資料還在', () => {
    const storage = memoryStorage();
    const now = clock(2026, 11, 18);
    createDaily(storage, now).toggle(2);
    expect(createDaily(storage, now).today()[2]).toBe(true);
  });
});

describe('連續天數', () => {
  it('今天和昨天都有做 → 2', () => {
    const now = clock(2026, 11, 17);
    const d = createDaily(memoryStorage(), now);
    d.toggle(0); now.addDays(1); d.toggle(0);
    expect(d.streak()).toBe(2);
  });
  it('今天還沒勾，但昨天、前天有 → 還是 2（今天還沒過完）', () => {
    const now = clock(2026, 11, 16);
    const d = createDaily(memoryStorage(), now);
    d.toggle(0); now.addDays(1); d.toggle(0); now.addDays(1);
    expect(d.streak()).toBe(2);
  });
  it('中斷一天 → 重新算', () => {
    const now = clock(2026, 11, 15);
    const d = createDaily(memoryStorage(), now);
    d.toggle(0); now.addDays(2); d.toggle(0);
    expect(d.streak()).toBe(1);
  });
  it('勾了又全部取消的那天不算', () => {
    const now = clock(2026, 11, 17);
    const d = createDaily(memoryStorage(), now);
    d.toggle(0); now.addDays(1); d.toggle(0); d.toggle(0);
    expect(d.streak()).toBe(1);
  });
  it('從來沒做過 → 0', () => {
    expect(createDaily(memoryStorage(), clock(2026, 11, 18)).streak()).toBe(0);
  });
});

describe('累積幾件 total()', () => {
  it('從開始記錄到現在一共勾了幾件；跨日照樣累加，取消勾選會減回去', () => {
    const now = clock(2026, 11, 17);
    const d = createDaily(memoryStorage(), now);
    expect(d.total()).toBe(0);
    d.toggle(0); d.toggle(1);
    expect(d.total()).toBe(2);
    now.addDays(1);
    d.toggle(2);
    expect(d.total()).toBe(3);
    d.toggle(2);
    expect(d.total()).toBe(2);
  });
  it('超過 90 天的日子不留明細，但件數加進 archived：累積一路只增不減', () => {
    const storage = memoryStorage();
    const now = clock(2026, 1, 1);
    const d = createDaily(storage, now);
    let expected = 0;
    for (let i = 0; i < 120; i += 1) {
      d.toggle(0); d.toggle(1); // 每天兩件
      expected += 2;
      expect(d.total(), `第 ${i + 1} 天`).toBe(expected);
      now.addDays(1);
    }
    const saved = JSON.parse(storage.getItem(DAILY_KEY));
    expect(Object.keys(saved.days)).toHaveLength(90);
    expect(saved.archived).toBe(60); // 最早的 30 天 × 2 件
    expect(d.total()).toBe(240);
    expect(createDaily(storage, now).total()).toBe(240); // 重建之後也一樣
  });
  it('裝置的時鐘被調回去（今天比所有紀錄都早）：今天的勾留得住，累積也不會越點越多', () => {
    const now = clock(2026, 1, 1);
    const d = createDaily(memoryStorage(), now);
    for (let i = 0; i < 90; i += 1) { d.set(0, true); now.addDays(1); } // 已經有滿 90 天的紀錄
    expect(d.total()).toBe(90);
    now.addDays(-200); // 時鐘調回比這 90 天都早的一天
    d.set(1, true);
    expect(d.today()).toEqual([false, true, false]); // 今天這一筆不能因為「最舊」就被收掉
    expect(d.total()).toBe(91);
    d.set(1, true); d.set(1, true); // 同一項再點幾次，也還是 91
    expect(d.total()).toBe(91);
  });
  it('存檔裡的 archived 會讀回來；不合理的值（負數、小數、字串）當成 0', () => {
    const now = clock(2026, 11, 18);
    const saved = (archived) => memoryStorage({ [DAILY_KEY]: JSON.stringify({ v: 1, days: { '2026-11-17': [true, true, false] }, archived }) });
    expect(createDaily(saved(40), now).total()).toBe(42);
    for (const bad of [-5, 2.5, '7', null]) expect(createDaily(saved(bad), now).total(), String(bad)).toBe(2);
    // 舊一點的存檔沒有 archived 欄位
    const noField = memoryStorage({ [DAILY_KEY]: JSON.stringify({ v: 1, days: { '2026-11-17': [true, true, false] } }) });
    expect(createDaily(noField, now).total()).toBe(2);
  });
});

describe('存檔', () => {
  it('只保留最近 90 天', () => {
    const storage = memoryStorage();
    const now = clock(2026, 1, 1);
    const d = createDaily(storage, now);
    for (let i = 0; i < 120; i += 1) { d.toggle(0); now.addDays(1); }
    d.toggle(0);
    const saved = JSON.parse(storage.getItem(DAILY_KEY));
    expect(Object.keys(saved.days).length).toBeLessThanOrEqual(90);
    expect(saved.days[dateKey(now())]).toBeTruthy();
  });
  it('存在 yinzhiDaily.v1 這個鍵，欄位是 days 和 archived（書上線之後不能再改）', () => {
    const storage = memoryStorage();
    createDaily(storage, clock(2026, 11, 18)).toggle(1);
    expect(DAILY_KEY).toBe('yinzhiDaily.v1');
    expect(JSON.parse(storage.getItem('yinzhiDaily.v1'))).toEqual({ v: 1, days: { '2026-11-18': [false, true, false] }, archived: 0 });
  });
  it('storage 丟例外、沒有 storage、存檔是亂碼或型別不對，都不當機', () => {
    const now = clock(2026, 11, 18);
    for (const storage of [
      brokenStorage(), null,
      memoryStorage({ [DAILY_KEY]: '{oops' }),
      memoryStorage({ [DAILY_KEY]: JSON.stringify({ v: 1, days: 'x' }) }),
      memoryStorage({ [DAILY_KEY]: JSON.stringify({ v: 1, days: { '2026-11-18': 'yes', bad: [true] } }) }),
      memoryStorage({ [DAILY_KEY]: JSON.stringify({ v: 9, days: { '2026-11-18': [true, true, true] } }) }),
      // 項數不對的紀錄（別本書一天是十項）不收
      memoryStorage({ [DAILY_KEY]: JSON.stringify({ v: 1, days: { '2026-11-18': Array(10).fill(true) } }) }),
    ]) {
      const d = createDaily(storage, now);
      expect(d.today()).toEqual([false, false, false]);
      expect(d.total()).toBe(0);
      expect(d.toggle(2)).toBe(true);
      expect(d.countToday()).toBe(1);
      expect(d.streak()).toBe(1);
      expect(d.total()).toBe(1);
    }
  });
});

describe('set(i, value)：直接指定勾或不勾', () => {
  it('指定成勾、指定成不勾；重複指定不會翻來翻去', () => {
    const d = createDaily(memoryStorage(), clock(2026, 11, 18));
    expect(d.set(2, true)).toBe(true);
    expect(d.set(2, true)).toBe(true);
    expect(d.countToday()).toBe(1);
    expect(d.set(2, false)).toBe(false);
    expect(d.countToday()).toBe(0);
  });
  it('超出範圍不理會', () => {
    const d = createDaily(memoryStorage(), clock(2026, 11, 18));
    expect(d.set(3, true)).toBe(false);
    expect(d.set(-1, true)).toBe(false);
    expect(d.countToday()).toBe(0);
  });
});

describe('同時開兩個分頁（每日種福）', () => {
  it('兩邊各勾各的，不會互相蓋掉', () => {
    const storage = memoryStorage();
    const now = clock(2026, 11, 18);
    const a = createDaily(storage, now);
    const b = createDaily(storage, now);
    b.toggle(0); b.toggle(1);
    a.toggle(2);
    expect(createDaily(storage, now).today().filter(Boolean)).toHaveLength(3);
    expect(a.countToday()).toBe(3);
  });
  it('refresh() 之後看得到另一個分頁勾的', () => {
    const storage = memoryStorage();
    const now = clock(2026, 11, 18);
    const a = createDaily(storage, now);
    createDaily(storage, now).toggle(2);
    expect(a.countToday()).toBe(0);
    a.refresh();
    expect(a.today()[2]).toBe(true);
    expect(a.total()).toBe(1);
  });
  it('寫入失敗之後，不會被 storage 裡的舊資料蓋掉（累積的件數也一樣）', () => {
    const now = clock(2026, 11, 18);
    const old = JSON.stringify({ v: 1, days: { '2026-11-18': [true, false, false] }, archived: 40 });
    const storage = { getItem: () => old, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    const d = createDaily(storage, now);
    d.toggle(1); d.toggle(2);
    expect(d.countToday()).toBe(3);
    expect(d.total()).toBe(43);
    d.refresh();
    expect(d.countToday()).toBe(3);
    expect(d.total()).toBe(43);
  });
});
