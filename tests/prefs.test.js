import { describe, it, expect } from 'vitest';
import { memoryStorage, brokenStorage } from './helpers/loadBook.js';
import { createPrefs } from '../js/prefs.js';
import { PREFS_KEY } from '../js/config.js';

describe('閱讀偏好：顯示注音', () => {
  it('預設是關的；沒動過就不寫進儲存空間', () => {
    const storage = memoryStorage();
    const p = createPrefs(storage);
    expect(p.getZhuyin()).toBe(false);
    expect(storage.getItem(PREFS_KEY)).toBeNull();
  });
  it('打開、關掉都會存起來，下次再開還記得', () => {
    const storage = memoryStorage();
    createPrefs(storage).setZhuyin(true);
    expect(JSON.parse(storage.getItem(PREFS_KEY))).toEqual({ v: 1, zhuyin: true });
    expect(createPrefs(storage).getZhuyin()).toBe(true);
    createPrefs(storage).setZhuyin(false);
    expect(createPrefs(storage).getZhuyin()).toBe(false);
  });
  it('存在 yinzhiPrefs.v1 這個鍵（同一個網域底下還有別本書，各存各的；書上線之後不能再改）', () => {
    const storage = memoryStorage();
    createPrefs(storage).setZhuyin(true);
    expect(PREFS_KEY).toBe('yinzhiPrefs.v1');
    expect(JSON.parse(storage.getItem('yinzhiPrefs.v1'))).toEqual({ v: 1, zhuyin: true });
  });
  it('只認 true／false：傳別的東西進來一律當成關', () => {
    const p = createPrefs(memoryStorage());
    for (const junk of ['yes', 1, null, undefined, {}]) {
      p.setZhuyin(junk);
      expect(p.getZhuyin(), String(junk)).toBe(false);
    }
  });
  it('存檔壞掉、版本不對、欄位型別不對：都當成預設（關）', () => {
    const cases = ['{oops', '"x"', '[]', 'null', JSON.stringify({ v: 2, zhuyin: true }), JSON.stringify({ v: 1, zhuyin: 'yes' }), JSON.stringify({ v: 1 })];
    for (const raw of cases) {
      expect(createPrefs(memoryStorage({ [PREFS_KEY]: raw })).getZhuyin(), raw).toBe(false);
    }
  });
  it('儲存空間不能用（無痕模式、被擋掉的 iframe）：不丟例外，這一次開著的期間照樣記得', () => {
    for (const storage of [brokenStorage(), null]) {
      const p = createPrefs(storage);
      expect(p.getZhuyin()).toBe(false);
      expect(() => p.setZhuyin(true)).not.toThrow();
      expect(p.getZhuyin()).toBe(true);
    }
  });
  it('另一個分頁改了之後，refresh 會讀到新的', () => {
    const storage = memoryStorage();
    const a = createPrefs(storage);
    const b = createPrefs(storage);
    a.setZhuyin(true);
    expect(b.getZhuyin()).toBe(false);
    b.refresh();
    expect(b.getZhuyin()).toBe(true);
  });
});
