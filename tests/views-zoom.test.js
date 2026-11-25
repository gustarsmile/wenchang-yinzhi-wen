// @vitest-environment happy-dom
// 點圖放大在整本書裡的行為，以及種子的條目上的補充說明。
// （大圖疊層本身的行為在 lightbox.test.js，歷程管理在 layer.test.js。）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBookFromDisk, loadSampleBook, SAMPLE, memoryStorage } from './helpers/loadBook.js';
import { createApp } from '../js/app.js';
import { createStore } from '../js/state.js';
import { createDaily } from '../js/daily.js';
import { createSpeech } from '../js/speech.js';
import { lampList } from '../js/book.js';
import { resetLayers } from '../js/ui/layer.js';
import { LAND_ART, LAND_ALT } from '../js/config.js';

const book = loadBookFromDisk();
// 補充說明的互動用樣本書測（第 2 頁是測試自己準備的固定內容，見 helpers/loadBook.js）
const sample = loadSampleBook();
const flush = () => new Promise((r) => setTimeout(r, 0));

let root; let store; let app;
function boot({ book: which = book } = {}) {
  app?.destroy();
  window.location.hash = '';
  document.body.textContent = '';
  root = document.createElement('div');
  document.body.appendChild(root);
  store = createStore(memoryStorage());
  app = createApp({
    root, book: which, store,
    daily: createDaily(memoryStorage(), () => new Date(2026, 10, 18, 12)),
    speech: createSpeech({ synth: undefined, Utterance: undefined }),
    win: window,
  });
  app.render();
}
const $ = (sel) => root.querySelector(sel);
const $$ = (sel) => [...root.querySelectorAll(sel)];
const lb = () => document.querySelector('#lightbox');
const isOpen = () => !!lb()?.classList.contains('open');
const key = (k) => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
// 把十一段都讀完：有種子的頁全部種下，沒有種子的頁翻過（「古今對照」另外算）
function finishChapters(skipNo = null) {
  for (const ch of book.chapters) {
    if (ch.no === skipNo) continue;
    if (lampList(ch)) lampList(ch).items.forEach((_, i) => store.lightLamp(ch.id, i));
    else store.markSeen(ch.id);
  }
}

beforeEach(() => {
  resetLayers();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(() => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })), 0);
  });
  boot();
});
afterEach(async () => {
  if (isOpen()) lb().click(); // 走真正的關閉路徑，lightbox.js 才會把自己的狀態歸零
  app.destroy();
  resetLayers();
  await flush();
  vi.restoreAllMocks();
});

describe('點圖放大', () => {
  it('封面的圖可以放大', () => {
    const btn = $('.cover-art .zoom-btn');
    btn.click();
    expect(isOpen()).toBe(true);
    expect(lb().querySelector('.lightbox-img').src).toMatch(/\/assets\/art\/cover\.webp$/);
  });

  it('十一頁的插圖都可以放大，大圖就是那一頁的圖', () => {
    expect(book.chapters).toHaveLength(11);
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      $('.chapter .ch-side .zoom-btn').click();
      expect(isOpen(), ch.id).toBe(true);
      expect(lb().querySelector('.lightbox-img').src.endsWith(`/assets/art/${ch.art}`), ch.id).toBe(true);
      expect(lb().querySelector('.lightbox-img').alt, ch.id).toBe(ch.alt);
      lb().click();
      expect(isOpen(), ch.id).toBe(false);
    }
  });

  it('四個典故的故事插圖也可以放大，大圖就是那一則故事的圖', () => {
    app.go('ch/2');
    const items = lampList(book.chapters[1]).items;
    expect(items).toHaveLength(4);
    items.forEach((item, i) => {
      const row = $$('.lamp-row')[i];
      row.querySelector('.lamp').click(); // 種下這一顆，故事才出現
      row.querySelector('.story-art .zoom-btn').click();
      expect(isOpen(), item.raw).toBe(true);
      expect(lb().querySelector('.lightbox-img').src.endsWith(`/assets/art/${item.story.art}`), item.raw).toBe(true);
      expect(lb().querySelector('.lightbox-img').alt, item.raw).toBe(item.story.alt);
      lb().click();
      expect(isOpen(), item.raw).toBe(false);
    });
    expect(store.litCount('ch02')).toBe(4); // 點圖放大、關掉，都不會多種或少種
  });

  it('大圖開著的時候，左右鍵不翻頁；關掉之後才恢復', () => {
    app.go('ch/3');
    $('.chapter .zoom-btn').click();
    key('ArrowRight'); key('ArrowLeft');
    expect(window.location.hash).toBe('#/ch/3');
    expect($('.chapter h1').textContent).toBe('心地福田');
    key('Escape');
    expect(isOpen()).toBe(false);
    expect(window.location.hash).toBe('#/ch/3'); // Esc 只關大圖，不離開這一頁
    key('ArrowRight');
    expect(window.location.hash).toBe('#/ch/4');
  });

  it('開關大圖不會動到網址（翻頁用的 hash 不變）', async () => {
    app.go('ch/5');
    $('.chapter .zoom-btn').click();
    expect(window.location.hash).toBe('#/ch/5');
    lb().click();
    await flush(); await flush();
    expect(window.location.hash).toBe('#/ch/5');
    expect($('.chapter h1').textContent).toBe('濟急救危');
  });

  it('我的福田：還有沒開的田時不能放大（放大就看光了）', () => {
    app.go('land');
    expect($('.land-frame .zoom-btn')).toBeNull();
    expect($$('.land-tile')).toHaveLength(12);
  });

  it('我的福田：十一段都讀完，只差「古今對照」那一塊，也還不能放大', () => {
    finishChapters();
    app.go('land');
    expect($('.land-frame .zoom-btn')).toBeNull();
    expect($$('.land-tile.soil')).toHaveLength(1);
    expect($('.land-tile.soil').textContent).toBe('古今對照');
  });

  it('我的福田：配對完成了，但最後一段還沒讀，一樣不能放大', () => {
    finishChapters(11);
    store.setMatchDone();
    app.go('land');
    expect($('.land-frame .zoom-btn')).toBeNull();
    expect($$('.land-tile.soil')).toHaveLength(1);
    expect($('.land-tile.soil').textContent).toBe('結語');
  });

  it('我的福田：十二塊田都開了之後，整張圖可以放大', () => {
    finishChapters();
    store.setMatchDone();
    app.go('land');
    expect($$('.land-tile')).toHaveLength(0);
    $('.land-frame .zoom-btn').click();
    expect(isOpen()).toBe(true);
    expect(lb().querySelector('.lightbox-img').src.endsWith(`/assets/art/${LAND_ART}`)).toBe(true);
    expect(lb().querySelector('.lightbox-img').alt).toBe(LAND_ALT);
  });
});

describe('app.destroy()', () => {
  it('拆掉之後，鍵盤和 hashchange 都不再讓它翻頁', () => {
    app.go('ch/3');
    app.destroy();
    key('ArrowRight');
    expect(window.location.hash).toBe('#/ch/3');
    window.location.hash = '#/ch/9';
    window.dispatchEvent(new Event('hashchange'));
    expect($('.chapter h1').textContent).toBe('心地福田'); // 畫面沒有跟著換
  });
});

describe('種子的條目上的補充說明', () => {
  it('有說明的條目，種下後連同白話一起顯示', () => {
    boot({ book: sample });
    app.go(`ch/${SAMPLE.no}`);
    const row = $$('.lamp-row')[SAMPLE.noteRow];
    expect(row.querySelector('.plain').hidden).toBe(true);
    row.querySelector('.lamp').click();
    expect(row.querySelector('.plain').hidden).toBe(false);
    expect(row.querySelector('.plain p').textContent).toBe(SAMPLE.rowPlain(SAMPLE.noteRow));
    expect(row.querySelector('.collation').textContent).toBe(SAMPLE.note);
    expect(row.querySelector('.plain').contains(row.querySelector('.collation'))).toBe(true); // 說明跟著白話一起收放
  });

  it('沒有說明的條目不會多出空的說明欄', () => {
    boot({ book: sample });
    app.go(`ch/${SAMPLE.no}`);
    $$('.lamp').forEach((p) => p.click());
    expect($$('.lamp-row .collation')).toHaveLength(1); // 只有樣本裡附了說明的那一列
    expect($$('.lamp-row')[0].querySelector('.collation')).toBeNull();
  });

  it('書裡每一列的補充說明都和資料一致：有寫的才出現，寫了什麼就顯示什麼', () => {
    let notes = 0;
    for (const ch of book.chapters.filter((c) => lampList(c))) {
      app.go(`ch/${ch.no}`);
      const rows = $$('.lamp-row');
      lampList(ch).items.forEach((item, i) => {
        const shown = [...rows[i].querySelectorAll('.collation')].map((n) => n.textContent);
        expect(shown, `${ch.id}｜${item.raw}`).toEqual(item.note ? [item.note] : []);
        if (item.note) notes += 1;
      });
    }
    expect(notes).toBeGreaterThan(0);
  });
});
