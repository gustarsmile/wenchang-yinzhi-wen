// @vitest-environment happy-dom
// 換頁時送 GA 的 page_view：每一頁有自己的標題和網址，GA 報表才看得出各頁有多少人讀。
// 這個檔測的是 app.js 的行為，和 config.js 的 GA_MEASUREMENT_ID 有沒有填無關（這裡不會用到那個 ID）：
// GA 還沒裝的時候 index.html 沒有 Google 代碼、window.gtag 不存在，這段程式什麼都不做；
// 這裡用假的 window.gtag 測「裝了之後」的行為，最後兩條測「沒有 gtag」的情況。
// index.html 和「關於本書」在有裝／沒裝兩種情況下各該長什麼樣子，分別在 html.test.js 和 views.test.js。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBookFromDisk, memoryStorage } from './helpers/loadBook.js';
import { createApp, pageViewUrl } from '../js/app.js';
import { createStore } from '../js/state.js';
import { createDaily } from '../js/daily.js';
import { createSpeech } from '../js/speech.js';
import { BOOK_TITLE, BOOK_URL, PARTS } from '../js/config.js';

const book = loadBookFromDisk();
let app; let gtag;

function boot({ hash = '', embedded = false } = {}) {
  app?.destroy();
  window.location.hash = hash;
  document.body.textContent = '';
  const root = document.createElement('div');
  document.body.appendChild(root);
  app = createApp({
    root, book, embedded,
    store: createStore(memoryStorage()),
    daily: createDaily(memoryStorage(), () => new Date(2026, 10, 19, 12)),
    speech: createSpeech({ synth: undefined, Utterance: undefined }),
    win: window,
  });
  app.render();
}
const pageViews = () => gtag.mock.calls.filter((c) => c[0] === 'event' && c[1] === 'page_view').map((c) => c[2]);

beforeEach(() => {
  gtag = vi.fn();
  window.gtag = gtag; // index.html 的 Google 代碼會定義這個全域函式
});
afterEach(() => {
  app?.destroy();
  app = null;
  delete window.gtag;
});

describe('pageViewUrl', () => {
  it('用書頁的路由當成網址路徑（不放 #），GA 的「網頁路徑」才分得開各頁', () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    expect(pageViewUrl(window.location, 'ch/3')).toBe(`${base}ch/3`);
    expect(pageViewUrl(window.location, '')).toBe(base);
    expect(pageViewUrl({ origin: 'https://edu.omilkyway.org', pathname: '/wenchang-yinzhi-wen/' }, 'land'))
      .toBe('https://edu.omilkyway.org/wenchang-yinzhi-wen/land');
  });
  it('書實際放的網址（config.js 的 BOOK_URL）底下，路徑接在書的目錄後面', () => {
    const at = new URL(BOOK_URL);
    expect(BOOK_URL).toBe('https://edu.omilkyway.org/wenchang-yinzhi-wen/');
    expect(pageViewUrl({ origin: at.origin, pathname: at.pathname }, 'ch/11')).toBe(`${BOOK_URL}ch/11`);
    expect(pageViewUrl({ origin: at.origin, pathname: at.pathname }, '')).toBe(BOOK_URL);
  });
  it('pathname 不是斜線結尾（例如 /index.html）也接得對', () => {
    expect(pageViewUrl({ origin: 'https://x.org', pathname: '/book/index.html' }, 'ch/1')).toBe('https://x.org/book/ch/1');
  });
});

describe('換頁時送 page_view', () => {
  it('第一次載入不送（Google 代碼自己會送第一筆）', () => {
    boot();
    expect(pageViews()).toEqual([]);
  });
  it('每翻到新的一頁送一筆，標題是那一頁的頁名', () => {
    boot();
    app.go('ch/3');
    app.go('ch/4');
    app.go('match');
    const titles = pageViews().map((p) => p.page_title);
    expect(titles).toEqual(['心地福田｜文昌帝君陰騭文', '人倫敬信｜文昌帝君陰騭文', '古今對照｜文昌帝君陰騭文']);
    expect(pageViews()[0].page_location).toBe(pageViewUrl(window.location, 'ch/3'));
  });
  it('十一頁各有各的標題和網址（報表裡才分得開）', () => {
    boot();
    const nos = book.chapters.map((c) => c.no);
    for (const no of nos) app.go(`ch/${no}`);
    const titles = pageViews().map((p) => p.page_title);
    expect(titles).toEqual(PARTS.map((name) => `${name}｜${BOOK_TITLE}`));
    expect(new Set(titles).size).toBe(11);
    expect(pageViews().map((p) => p.page_location)).toEqual(nos.map((no) => pageViewUrl(window.location, `ch/${no}`)));
    expect(new Set(pageViews().map((p) => p.page_location)).size).toBe(11);
  });
  it('不是書頁的頁面也各有標題：目錄、古今對照、我的福田、時時方便、關於本書', () => {
    boot();
    for (const route of ['toc', 'match', 'land', 'daily', 'about']) app.go(route);
    expect(pageViews().map((p) => p.page_title)).toEqual(
      ['目錄', '古今對照', '我的福田', '時時方便', '關於本書'].map((name) => `${name}｜文昌帝君陰騭文`),
    );
  });
  it('同一頁重畫（例如時時方便跨日時整頁換成今天）不重複送', () => {
    boot();
    app.go('daily');
    app.go('daily');
    app.render();
    expect(pageViews()).toHaveLength(1);
    expect(pageViews()[0].page_title).toBe('時時方便｜文昌帝君陰騭文');
  });
  it('瀏覽器上一頁（hashchange）也算一次換頁', () => {
    boot({ hash: '#/ch/5' });
    window.location.hash = '#/ch/6';
    window.dispatchEvent(new Event('hashchange'));
    expect(pageViews().map((p) => p.page_title)).toEqual(['公平公益｜文昌帝君陰騭文']);
  });
  it('回到封面也送（標題是書名）', () => {
    boot({ hash: '#/ch/1' });
    app.go('');
    expect(pageViews().map((p) => p.page_title)).toEqual(['文昌帝君陰騭文｜互動電子書']);
  });
  it('嵌在別的網頁裡一樣會送', () => {
    boot({ embedded: true });
    const replace = vi.spyOn(window.location, 'replace').mockImplementation((h) => { window.location.hash = h; });
    app.go('ch/2');
    expect(pageViews().map((p) => p.page_title)).toEqual(['四個典故｜文昌帝君陰騭文']);
    replace.mockRestore();
  });
  it('沒有 Google 代碼（還沒裝、被擋廣告的外掛擋掉、離線）時什麼都不做，也不會出錯', () => {
    delete window.gtag;
    boot();
    expect(() => app.go('ch/3')).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
    expect(document.querySelector('.chapter h1').textContent).toBe('心地福田');
  });
  it('gtag 本身丟例外也不影響翻頁', () => {
    window.gtag = () => { throw new Error('blocked'); };
    boot();
    expect(() => app.go('ch/3')).not.toThrow();
    expect(document.querySelector('.chapter h1').textContent).toBe('心地福田');
  });
});
