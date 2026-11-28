// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadBookFromDisk, loadSampleBook, SAMPLE, memoryStorage } from './helpers/loadBook.js';
import { createApp } from '../js/app.js';
import { createStore } from '../js/state.js';
import { createDaily } from '../js/daily.js';
import { createSpeech } from '../js/speech.js';
import { lampList, chapterTitle, chapterRaw, pages, plotCount } from '../js/book.js';
import { OVERVIEW_GROUPS } from '../js/ui/chapterView.js';
import { landPlots } from '../js/ui/landView.js';
import { PARTS, LAMP_COUNTS, LAND_ART, SOURCE, SAVE_KEY, DAILY_KEY, GA_MEASUREMENT_ID } from '../js/config.js';

const book = loadBookFromDisk();
// 情境題、難詞、補充說明的互動用樣本書測（第 2 頁是測試自己準備的固定內容，見 helpers/loadBook.js）
const sample = loadSampleBook();
const noSpeech = () => createSpeech({ synth: undefined, Utterance: undefined });

function fakeSpeech() {
  const spoken = [];
  class U { constructor(t) { this.text = t; } }
  const synth = { getVoices: () => [{ lang: 'zh-TW', name: 'v' }], speak: (u) => spoken.push(u), cancel() {} };
  return { speech: createSpeech({ synth, Utterance: U }), spoken };
}

let root; let store; let daily; let app;
function boot({ speech = noSpeech(), storage = memoryStorage(), dailyStorage = memoryStorage(), hash = '', book: which = book } = {}) {
  app?.destroy(); // 上一個測試的 app 不要留在頁面上繼續聽鍵盤
  window.location.hash = hash;
  root = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(root);
  store = createStore(storage);
  daily = createDaily(dailyStorage, () => new Date(2026, 10, 18, 12));
  app = createApp({ root, book: which, store, daily, speech, win: window });
  app.render();
  return app;
}
const $ = (sel) => root.querySelector(sel);
const $$ = (sel) => [...root.querySelectorAll(sel)];
const text = () => root.textContent;
const texts = (sel) => $$(sel).map((n) => n.textContent);

// 種子在程式裡沿用《太上感應篇》那本的名字（lamp、lit、lightLamp），畫面上一律稱「種子」
const lightPage = (no) => lampList(book.chapters[no - 1]).items.forEach((_, i) => store.lightLamp(`ch${String(no).padStart(2, '0')}`, i));
// 把十一段都讀完：有種子的頁全部種下，沒有種子的頁翻過。skip 是要跳過的那一頁。「古今對照」另外算（store.setMatchDone）
function finishChapters(skip = null) {
  for (const ch of book.chapters) {
    if (ch.no === skip) continue;
    if (lampList(ch)) lightPage(ch.no);
    else store.markSeen(ch.id);
  }
}
// 「我的福田」十二塊田的名字，照翻頁的順序：第 1–10 段、古今對照、第 11 段
const PLOT_NAMES = [...PARTS.slice(0, 10), '古今對照', PARTS[10]];

beforeEach(() => { boot(); });

describe('封面', () => {
  it('有書名、署名和「開始閱讀」', () => {
    expect($('.cover h1').textContent).toBe('文昌帝君陰騭文');
    expect($('.cover-by').textContent).toBe(SOURCE.byline);
    expect($('.cover-by').textContent).toContain('文昌帝君'); // 署名的措辭在 config.js 的 SOURCE.byline，這裡只守「有寫是誰」
    expect($('.cover-intro').textContent).toContain('「欲廣福田，須憑心地。」');
    expect($('.cover-intro').textContent).toContain('636 個字');
    expect($('.cover-intro').textContent).toContain('60 顆等你種下的種子');
    expect($('[data-action="start"]')).toBeTruthy();
    expect($('[data-action="continue"]')).toBeNull();
  });
  it('按「開始閱讀」到第一頁', () => {
    $('[data-action="start"]').click();
    expect(window.location.hash).toBe('#/ch/1');
    expect($('.chapter h1').textContent).toBe('帝君自述');
  });
  it('讀過之後回封面，會出現「繼續閱讀」並帶回上次的那一頁', () => {
    app.go('ch/5');
    app.go('');
    const btn = $('[data-action="continue"]');
    expect(btn.textContent).toContain('第五段 濟急救危');
    btn.click();
    expect(window.location.hash).toBe('#/ch/5');
  });
  it('「繼續閱讀」寫的是第幾段和頁名；這時另有「從頭開始」', () => {
    app.go('ch/8');
    app.go('');
    expect($('[data-action="continue"]').textContent).toBe('繼續閱讀：第八段 十勿');
    app.go('ch/11');
    app.go('');
    expect($('[data-action="continue"]').textContent).toBe('繼續閱讀：第十一段 結語');
    expect($('[data-action="start"]').textContent).toBe('從頭開始');
    $('[data-action="start"]').click();
    expect(window.location.hash).toBe('#/ch/1');
  });
  it('存檔裡的「上次位置」不是真的書頁（舊版、被改過、別本書的頁次）→ 不顯示「繼續閱讀」', () => {
    // ch/12、ch/13 在《太上感應篇》那本是有的，這本只有 11 頁
    for (const last of ['ch/99', 'ch/12', 'ch/13', 'ch/0', 'toc', 'xyz']) {
      const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify({ v: 1, lamps: {}, seen: [], scenario: {}, match: false, last }) });
      boot({ storage });
      expect($('[data-action="continue"]'), last).toBeNull();
      expect($('[data-action="start"]'), last).toBeTruthy();
    }
  });
  it('上次停在古今對照或我的福田，也能繼續', () => {
    app.go('match'); app.go('');
    expect($('[data-action="continue"]').textContent).toBe('繼續閱讀：古今對照');
    app.go('land'); app.go('');
    expect($('[data-action="continue"]').textContent).toBe('繼續閱讀：我的福田');
  });
  it('封面不顯示頂列，其他頁有', () => {
    expect($('.topbar').hidden).toBe(true);
    app.go('toc');
    expect($('.topbar').hidden).toBe(false);
  });
  it('還沒開始讀不顯示進度；讀完一段或種過種子之後才顯示', () => {
    expect($('.cover-progress')).toBeNull();
    app.go('ch/1'); // 〈帝君自述〉沒有種子，讀過就開一塊田
    app.go('');
    expect($('.cover-progress').textContent).toContain('種子 0／60');
    expect($('.cover-progress').textContent).toContain('福田 1／12');
    store.lightLamp('ch05', 0);
    app.go('');
    expect($('.cover-progress').textContent).toContain('種子 1／60');
    expect($('.cover-progress').textContent).toContain('福田 1／12'); // 第 5 頁還沒種完，田還沒開
  });
  it('只種過種子、還沒開任何一塊田，也顯示進度；「古今對照」配對完成算一塊田', () => {
    store.lightLamp('ch05', 0);
    app.go('');
    expect($('.cover-progress').textContent).toContain('種子 1／60');
    expect($('.cover-progress').textContent).toContain('福田 0／12');
    boot();
    store.setMatchDone();
    app.go('');
    expect($('.cover-progress').textContent).toContain('種子 0／60');
    expect($('.cover-progress').textContent).toContain('福田 1／12');
  });
  it('下面有目錄、每日種福、關於本書三個連結', () => {
    expect(texts('.cover-links button')).toEqual(['目錄', '每日種福', '關於本書']);
    $$('.cover-links button')[1].click();
    expect(window.location.hash).toBe('#/daily');
  });
});

describe('頂列', () => {
  it('書名用短的「陰騭文」（手機上才放得下），完整的書名寫在 aria-label；按了回封面', () => {
    app.go('ch/3');
    const title = $('.tb-title');
    expect(title.textContent).toBe('陰騭文');
    expect(title.getAttribute('aria-label')).toBe('文昌帝君陰騭文：回封面');
    title.click();
    expect(window.location.hash).toBe('#/');
    expect($('.cover')).toBeTruthy();
  });
  it('右邊是種子數「種子 n／60」，按了到「我的福田」', () => {
    app.go('ch/5');
    expect($('.tb-lamps').textContent).toBe('種子 0／60');
    $$('.lamp')[0].click();
    expect($('.tb-lamps').textContent).toBe('種子 1／60');
    expect($('.tb-lamps').getAttribute('aria-label')).toBe('已種下 1 顆種子，共 60 顆。前往「我的福田」');
    $('.tb-lamps').click();
    expect(window.location.hash).toBe('#/land');
  });
  it('左邊是目錄', () => {
    app.go('ch/3');
    expect($('.tb-btn').textContent).toBe('目錄');
    $('.tb-btn').click();
    expect(window.location.hash).toBe('#/toc');
  });
});

describe('章節頁', () => {
  it('十一頁都能畫出來，標題、副題、導讀、原文、白話、帶走的一句話都在', () => {
    expect(book.chapters).toHaveLength(11);
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect($('.chapter h1').textContent, ch.id).toBe(chapterTitle(ch));
      expect($('.chapter h1').textContent, ch.id).toBe(PARTS[ch.no - 1]);
      expect($('.ch-sub').textContent, ch.id).toBe(ch.subtitle);
      expect($('.ch-side .lead').textContent, ch.id).toBe(ch.lead);
      const first = ch.blocks[0].type === 'list' ? ch.blocks[0].items[0] : ch.blocks[0];
      expect($('.sutra').textContent, ch.id).toContain(first.raw.slice(0, 8));
      expect($('.sutra').textContent, ch.id).toContain(first.plain.slice(0, 8));
      expect($('.chapter img').getAttribute('src'), ch.id).toBe(`assets/art/${ch.art}`);
      expect($('.chapter img').getAttribute('alt'), ch.id).toBe(ch.alt);
      expect($('.takeaway').textContent, ch.id).toBe(ch.takeaway);
      expect($('.chapter').classList.contains(`kind-${ch.kind}`), ch.id).toBe(true);
    }
  });
  it('原文一字不漏、照順序出現在畫面上（每一頁）', () => {
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect(texts('.sutra .raw').join(''), ch.id).toBe(chapterRaw(ch));
    }
  });
  it('段次寫「第幾段」（《陰騭文》沒有傳統的分章，不寫第幾章）', () => {
    const kicker = (no) => { app.go(`ch/${no}`); return $('.ch-kicker').textContent; };
    expect(kicker(1)).toBe('第一段');
    expect(kicker(2)).toBe('第二段');
    expect(kicker(4)).toBe('第四段');
    expect(kicker(8)).toBe('第八段');
    expect(kicker(10)).toBe('第十段');
    expect(kicker(11)).toBe('第十一段');
  });
  it('看過的頁會記下來，並更新「上次讀到」', () => {
    app.go('ch/4');
    expect(store.isSeen('ch04')).toBe(true);
    expect(store.getLast()).toBe('ch/4');
  });
  it('上一頁、下一頁照頁序走；第 10 頁〈修路造橋〉之後是古今對照，再來才是第 11 頁', () => {
    app.go('ch/10');
    expect($('[data-action="next"]').textContent).toBe('古今對照 ›');
    $('[data-action="next"]').click();
    expect(window.location.hash).toBe('#/match');
    expect($('[data-action="prev"]').textContent).toBe('‹ 修路造橋');
    expect($('[data-action="next"]').textContent).toBe('結語 ›');
    $('[data-action="next"]').click();
    expect(window.location.hash).toBe('#/ch/11');
    $('[data-action="prev"]').click();
    expect(window.location.hash).toBe('#/match');
    $('[data-action="prev"]').click();
    expect(window.location.hash).toBe('#/ch/10');
    app.go('ch/11');
    expect($('[data-action="next"]').textContent).toBe('我的福田 ›');
    $('[data-action="next"]').click();
    expect(window.location.hash).toBe('#/land');
    app.go('ch/1');
    expect($('[data-action="prev"]').textContent).toBe('‹ 封面');
    $('[data-action="prev"]').click();
    expect(window.location.hash).toBe('#/');
  });
  it('第一頁有「全篇十一段」一覽，點一下跳到那一段', () => {
    app.go('ch/1');
    expect($('.overview h2').textContent).toBe('全篇十一段');
    expect(texts('.overview-chip .chip-name')).toEqual(PARTS);
    expect(texts('.overview-chip .chip-sub')).toHaveLength(11);
    expect(texts('.overview-chip .chip-sub').every((s) => s.trim().length > 0)).toBe(true); // 每一段都有一句話的說明
    expect(texts('.overview-group')).toEqual(OVERVIEW_GROUPS.map(([title]) => title));
    const chip = (i) => { app.go('ch/1'); return $$('.overview-chip')[i]; };
    expect(chip(4).textContent).toContain('濟急救危');
    chip(4).click();
    expect(window.location.hash).toBe('#/ch/5');
    chip(1).click();
    expect(window.location.hash).toBe('#/ch/2');
    chip(7).click();
    expect(window.location.hash).toBe('#/ch/8');
    chip(10).click();
    expect(window.location.hash).toBe('#/ch/11');
  });
  it('一覽的分組把十一段各放進一組，沒有漏掉也沒有重複', () => {
    expect(OVERVIEW_GROUPS.flatMap(([, parts]) => parts)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    app.go('ch/1');
    expect($$('.overview-chips').map((wrap) => wrap.querySelectorAll('.overview-chip').length)).toEqual(OVERVIEW_GROUPS.map(([, parts]) => parts.length));
  });
  it('一覽上的進度：有種子的段顯示種下幾顆，沒有種子的段顯示讀過了沒', () => {
    const progress = () => { app.go('ch/1'); return $$('.overview-chip .chip-progress'); };
    let p = progress();
    expect(p.map((n) => n.textContent)).toEqual(['已讀', '0／4', '未讀', '未讀', '0／12', '0／8', '0／8', '0／10', '0／8', '0／10', '未讀']);
    expect(p.map((n) => n.textContent)).toEqual(LAMP_COUNTS.map((n, i) => (n ? `0／${n}` : i === 0 ? '已讀' : '未讀')));
    expect(p.map((n) => n.classList.contains('done'))).toEqual([true, ...Array(10).fill(false)]);

    store.lightLamp('ch05', 0); store.lightLamp('ch06', 0); store.lightLamp('ch10', 5);
    app.go('ch/3');
    p = progress();
    expect(p[2].textContent).toBe('已讀');
    expect(p[2].classList.contains('done')).toBe(true);
    expect(p[4].textContent).toBe('1／12');
    expect(p[5].textContent).toBe('1／8');
    expect(p[9].textContent).toBe('1／10');
    expect(p[4].classList.contains('done')).toBe(false);

    lightPage(5);
    p = progress();
    expect(p[4].textContent).toBe('12／12');
    expect(p[4].classList.contains('done')).toBe(true);
  });
  it('只有第一頁有一覽', () => {
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect($$('.overview'), ch.id).toHaveLength(ch.no === 1 ? 1 : 0);
    }
  });
  it('白話可以收起來再打開', () => {
    app.go('ch/1');
    const toggle = $('[data-action="toggle-plain"]');
    expect($('.passage .plain').hidden).toBe(false);
    toggle.click();
    expect($$('.passage .plain').every((p) => p.hidden)).toBe(true);
    toggle.click();
    expect($('.passage .plain').hidden).toBe(false);
  });
  it('只有清單的頁（第 5–10 頁）沒有「白話：開／關」按鈕；有段落的頁才有', () => {
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      const hasPassage = ch.blocks.some((b) => b.type === 'passage');
      expect($$('[data-action="toggle-plain"]'), ch.id).toHaveLength(hasPassage ? 1 : 0);
    }
    expect(book.chapters.filter((c) => !c.blocks.some((b) => b.type === 'passage')).map((c) => c.no)).toEqual([5, 6, 7, 8, 9, 10]);
  });
  it('第 2 頁有段落也有清單：白話開關只管段落，清單裡還沒種下的白話不會跟著跑出來', () => {
    app.go('ch/2');
    const toggle = $('[data-action="toggle-plain"]');
    toggle.click();
    expect($$('.passage .plain').every((p) => p.hidden)).toBe(true);
    toggle.click();
    expect($$('.passage .plain').every((p) => !p.hidden)).toBe(true);
    expect($$('.lamp-row .plain').every((p) => p.hidden)).toBe(true);
  });
  it('最後一頁有前往「我的福田」的按鈕；其他頁沒有', () => {
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect($$('.cta'), ch.id).toHaveLength(ch.no === 11 ? 1 : 0);
    }
    expect($('.cta button').textContent).toBe('去看「我的福田」');
    $('.cta button').click();
    expect(window.location.hash).toBe('#/land');
  });
});

describe('種子', () => {
  it('第 5 頁有 12 顆，一開始都沒種，白話藏著', () => {
    app.go('ch/5');
    expect($$('.lamp')).toHaveLength(12);
    expect($$('.lamp.lit')).toHaveLength(0);
    expect($$('.lamp').every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect($$('.lamp-row .plain').every((p) => p.hidden)).toBe(true);
    expect($('.tb-lamps').textContent).toContain('0／60');
  });
  it('點一顆：發芽、顯示白話、計數加一、存進進度', () => {
    app.go('ch/5');
    $$('.lamp')[0].click();
    expect($$('.lamp')[0].classList.contains('lit')).toBe(true);
    expect($$('.lamp')[0].getAttribute('aria-pressed')).toBe('true');
    expect($$('.lamp-row')[0].classList.contains('lit')).toBe(true);
    expect($$('.lamp-row .plain')[0].hidden).toBe(false);
    expect($$('.lamp-row .plain')[0].textContent).toContain(lampList(book.chapters[4]).items[0].plain);
    expect($$('.lamp-row .plain')[1].hidden).toBe(true); // 別列的白話還藏著
    expect($('.tb-lamps').textContent).toContain('1／60');
    expect($('.lamp-count').textContent).toBe('已種下 1／12');
    expect(store.isLit('ch05', 0)).toBe(true);
  });
  it('重複點同一顆不會重複計數', () => {
    app.go('ch/5');
    $$('.lamp')[0].click(); $$('.lamp')[0].click();
    expect(store.totalLit()).toBe(1);
    expect($('.tb-lamps').textContent).toContain('1／60');
  });
  it('離開再回來，種下的還在', () => {
    app.go('ch/5');
    $$('.lamp')[2].click();
    app.go('ch/6'); app.go('ch/5');
    expect($$('.lamp')[2].classList.contains('lit')).toBe(true);
    expect($$('.lamp-row .plain')[2].hidden).toBe(false);
    expect($$('.lamp.lit')).toHaveLength(1);
  });
  it('一頁全部種下後出現訊息：「我的福田」開了一塊花田，可以直接過去看', () => {
    app.go('ch/5');
    expect($('.lamps-done').hidden).toBe(true);
    $$('.lamp').slice(0, 11).forEach((p) => p.click());
    expect($('.lamps-done').hidden).toBe(true); // 還差一顆
    $$('.lamp')[11].click();
    expect($('.lamps-done').hidden).toBe(false);
    expect($('.lamps-done').textContent).toContain('〈濟急救危〉的種子全部種下了，「我的福田」開了一塊花田。');
    expect(store.isChapterComplete(book.chapters[4])).toBe(true);
    expect(store.isPartComplete(book.chapters, 5)).toBe(true);
    $('.lamps-done button').click();
    expect(window.location.hash).toBe('#/land');
    expect($$('.land-tile')[4].classList.contains('clear')).toBe(true); // 說開了一塊，就真的開了那一塊
  });
  it('每一頁有種子的頁，種完說的都是自己這一頁；已經種完的頁，回來時訊息還在', () => {
    for (const ch of book.chapters.filter((c) => lampList(c))) {
      app.go(`ch/${ch.no}`);
      expect($('.lamps-done').hidden, ch.id).toBe(true);
      $$('.lamp').forEach((p) => p.click());
      expect($('.lamps-done').hidden, ch.id).toBe(false);
      expect($('.lamps-done').textContent, ch.id).toContain(`〈${ch.title}〉的種子全部種下了`);
    }
    expect(store.totalLit()).toBe(60);
    app.go('ch/8');
    expect($('.lamps-done').hidden).toBe(false);
    expect($('.lamps-done').textContent).toContain('〈十勿〉的種子全部種下了');
  });
  it('每一頁的種子數等於該頁清單的列數，也等於 config 的 LAMP_COUNTS；清單的名目和說明照資料顯示', () => {
    for (const ch of book.chapters.filter((c) => lampList(c))) {
      app.go(`ch/${ch.no}`);
      expect($$('.lamp'), ch.id).toHaveLength(lampList(ch).items.length);
      expect($$('.lamp'), ch.id).toHaveLength(LAMP_COUNTS[ch.no - 1]);
      expect($('.lamp-count').textContent, ch.id).toBe(`已種下 0／${LAMP_COUNTS[ch.no - 1]}`);
      expect($('.list-name').textContent, ch.id).toBe(lampList(ch).name);
      expect($('.list-note').textContent, ch.id).toBe(lampList(ch).nameNote);
    }
  });
  it('沒有清單的頁沒有種子', () => {
    for (const no of [1, 3, 4, 11]) {
      app.go(`ch/${no}`);
      expect($$('.lamp'), `第 ${no} 頁`).toHaveLength(0);
      expect($$('.lamps-done'), `第 ${no} 頁`).toHaveLength(0);
    }
  });
  it('清單的性質（tone）決定樣式和上面那句提示：典故、善行、〈十勿〉各不相同', () => {
    const at = (no) => { app.go(`ch/${no}`); return { list: $('.lamps').classList, hint: $('.lamps > .hint').textContent }; };
    expect(at(2).list.contains('tone-story')).toBe(true);
    expect(at(2).hint).toBe('每一句底下就是它的故事。點一下那一句，看白話，種下一顆種子。');
    for (const no of [5, 6, 7, 9, 10]) {
      expect(at(no).list.contains('tone-good'), `第 ${no} 頁`).toBe(true);
      expect(at(no).hint, `第 ${no} 頁`).toBe('點一下，看白話，種下一顆種子。');
    }
    expect(at(8).list.contains('tone-guard')).toBe(true);
    expect(at(8).hint).toBe('點一下，看白話，種下一顆種子：看清一件不該做的事、守住它，心地就乾淨一分。');
  });
});

describe('四個典故的故事', () => {
  const items = lampList(book.chapters[1]).items;

  it('第 2 頁每一列底下有一則故事，一打開就看得到（白話還是種下才出現）：標題、人物、插圖、故事、出處', () => {
    app.go('ch/2');
    expect(items).toHaveLength(4);
    expect($$('.lamp-row .plain').every((p) => p.hidden)).toBe(true);
    items.forEach((item, i) => {
      const row = $$('.lamp-row')[i];
      const box = row.querySelector('.story');
      expect(box, item.raw).toBeTruthy();
      expect(row.querySelector('.plain').contains(box), item.raw).toBe(false); // 在白話那一塊外面，沒種下也看得到
      expect(box.closest('[hidden]'), item.raw).toBeNull();
      expect(store.isLit('ch02', i), item.raw).toBe(false);
      row.querySelector('.lamp').click();
      expect(row.querySelector('.plain').hidden, item.raw).toBe(false);
      expect(row.querySelector('.plain p').textContent, item.raw).toBe(item.plain);
      expect(box.querySelector('.story-title').textContent, item.raw).toBe(item.story.title);
      expect(box.querySelector('.story-who').textContent, item.raw).toBe(item.story.who);
      expect(box.querySelector('.story-text').textContent, item.raw).toBe(item.story.text);
      expect(box.querySelector('.story-source').textContent, item.raw).toBe(`出處：${item.story.source}`);
      const img = box.querySelector('.story-art img');
      expect(img.getAttribute('src'), item.raw).toBe(`assets/art/${item.story.art}`);
      expect(img.getAttribute('alt'), item.raw).toBe(item.story.alt);
    });
    expect($$('.story')).toHaveLength(4);
  });
  it('一列裡的順序是：原文 → 白話與補充說明（點了才出現）→ 故事（一直看得到）', () => {
    boot({ book: sample });
    app.go(`ch/${SAMPLE.no}`);
    const row = $$('.lamp-row')[SAMPLE.noteRow];
    row.querySelector('.lamp').click();
    const plainParts = [...row.querySelector('.plain').children];
    expect(plainParts.map((n) => n.className)).toEqual(['', 'collation']);
    expect(plainParts[0].textContent).toBe(SAMPLE.rowPlain(SAMPLE.noteRow));
    expect(plainParts[1].textContent).toBe(SAMPLE.note);
    const body = [...row.querySelector('.lamp-body').children].map((n) => n.className);
    expect(body.indexOf('story')).toBe(body.indexOf('plain') + 1);
    const parts = [null, row.querySelector('.story')];
    expect([...parts[1].children].map((n) => n.className)).toEqual(['story-title', 'story-who', 'art-frame story-art', 'story-text', 'story-source']);
    expect(parts[1].querySelector('.story-title').textContent).toBe(SAMPLE.story.title);
    expect(parts[1].querySelector('.story-who').textContent).toBe(SAMPLE.story.who);
    expect(parts[1].querySelector('.story-text').textContent).toBe(SAMPLE.story.text);
    expect(parts[1].querySelector('.story-source').textContent).toBe('出處：樣本出處');
    expect(parts[1].querySelector('img').getAttribute('src')).toBe(`assets/art/${SAMPLE.story.art}`);
    expect(parts[1].querySelector('img').getAttribute('alt')).toBe(SAMPLE.story.alt);
  });
  it('沒有故事的列不會多出空的故事框', () => {
    boot({ book: sample });
    app.go(`ch/${SAMPLE.no}`);
    $$('.lamp').forEach((p) => p.click());
    expect($$('.story')).toHaveLength(1); // 只有樣本裡附了故事的那一列
    expect($$('.lamp-row')[0].querySelector('.story')).toBeNull();
    boot();
    for (const no of [5, 6, 7, 8, 9, 10]) {
      app.go(`ch/${no}`);
      expect($$('.story'), `第 ${no} 頁`).toHaveLength(0);
    }
  });
  it('故事裡的字不算原文：不會被朗讀，也不會混進這一頁的原文', () => {
    const { speech, spoken } = fakeSpeech();
    boot({ speech });
    app.go('ch/2');
    $$('.lamp').forEach((p) => p.click());
    expect(texts('.sutra .raw').join('')).toBe(chapterRaw(book.chapters[1]));
    expect($$('.story .raw')).toHaveLength(0);
    $('.btn-speak').click();
    expect(spoken.map((u) => u.text).join('')).toBe(chapterRaw(book.chapters[1]));
  });
});

describe('清單分組', () => {
  it('每一組有小標，各自是一個清單；種子的編號接著數下去', () => {
    boot({ book: sample });
    app.go(`ch/${SAMPLE.no}`);
    expect(texts('.lamp-group')).toEqual(SAMPLE.groups.map(([name]) => name));
    expect($$('.lamp-list').map((ol) => ol.querySelectorAll('.lamp-row').length)).toEqual(SAMPLE.groups.map(([, size]) => size));
    for (const h of $$('.lamp-group')) {
      expect(h.tagName).toBe('H3');
      expect(h.nextElementSibling.tagName).toBe('OL'); // 小標後面緊接著它那一組
      expect(h.nextElementSibling.classList.contains('lamp-list')).toBe(true);
    }
    expect($$('.lamp')).toHaveLength(4);
    expect($$('.lamp').map((b) => b.getAttribute('aria-label'))).toEqual(Array.from({ length: 4 }, (_, i) => `第 ${i + 1} 顆種子`));
    // 分了組，點的還是原來那一列：第二組的第二顆是全頁的第 3 顆，第三組的第一顆是全頁的第 4 顆
    $$('.lamp-list')[1].querySelectorAll('.lamp')[1].click();
    expect(store.isLit(SAMPLE.id, 2)).toBe(true);
    expect(store.totalLit()).toBe(1);
    expect($$('.lamp-list')[1].querySelectorAll('.plain')[1].textContent).toBe(SAMPLE.rowPlain(2));
    $$('.lamp-list')[2].querySelector('.lamp').click();
    expect(store.isLit(SAMPLE.id, 3)).toBe(true);
    expect($$('.lamp-list')[2].querySelector('.plain').textContent).toBe(SAMPLE.rowPlain(3));
  });
  it('書裡每一頁的清單，小標和各組的列數都和資料一致；種子的編號從 1 接著數到最後', () => {
    let groupedPages = 0;
    for (const ch of book.chapters.filter((c) => lampList(c))) {
      app.go(`ch/${ch.no}`);
      const { items } = lampList(ch);
      const names = [...new Set(items.map((it) => it.group).filter(Boolean))];
      const sizes = names.length ? names.map((name) => items.filter((it) => it.group === name).length) : [items.length];
      expect(texts('.lamp-group'), ch.id).toEqual(names);
      expect($$('.lamp-list').map((ol) => ol.querySelectorAll('.lamp-row').length), ch.id).toEqual(sizes);
      expect($$('.lamp').map((b) => b.getAttribute('aria-label')), ch.id).toEqual(items.map((_, i) => `第 ${i + 1} 顆種子`));
      if (names.length) groupedPages += 1;
    }
    expect(groupedPages).toBeGreaterThan(0);
  });
  it('沒有分組的清單就是一整個清單，沒有小標', () => {
    // 書裡的第 2 頁〈四個典故〉本來就沒有分組
    app.go('ch/2');
    expect(lampList(book.chapters[1]).items.some((it) => it.group)).toBe(false);
    expect($$('.lamp-group')).toHaveLength(0);
    expect($$('.lamp-list')).toHaveLength(1);
    expect($$('.lamp-list .lamp-row')).toHaveLength(4);
    // 把第 5 頁的分組拿掉，也一樣
    const flat = loadBookFromDisk();
    for (const it of lampList(flat.chapters[4]).items) delete it.group;
    boot({ book: flat });
    app.go('ch/5');
    expect($$('.lamp-group')).toHaveLength(0);
    expect($$('.lamp-list')).toHaveLength(1);
    expect($$('.lamp-list .lamp-row')).toHaveLength(12);
  });
});

describe('情境題', () => {
  beforeEach(() => { boot({ book: sample }); app.go(`ch/${SAMPLE.no}`); });

  it('選一個選項就顯示那個選項的回饋，並記下來', () => {
    const opts = $$('.scenario .option');
    expect(opts).toHaveLength(3);
    expect($('.scenario h2').textContent).toBe('生活裡的這一段');
    expect($('.scenario .prompt').textContent).toBe(SAMPLE.scenario.prompt);
    expect($('.scenario .reply').hidden).toBe(true);
    opts[1].click();
    expect($('.scenario .reply').hidden).toBe(false);
    expect($('.scenario .reply').textContent).toBe('樣本回饋乙');
    expect(opts[1].classList.contains('chosen')).toBe(true);
    expect(opts.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(store.getScenario(SAMPLE.id)).toBe(1);
  });
  it('可以改選', () => {
    $$('.scenario .option')[0].click();
    $$('.scenario .option')[2].click();
    expect($$('.scenario .option.chosen')).toHaveLength(1);
    expect($('.scenario .reply').textContent).toBe('樣本回饋丙');
    expect(store.getScenario(SAMPLE.id)).toBe(2);
  });
  it('回到這一頁時，上次的選擇還在', () => {
    $$('.scenario .option')[0].click();
    app.go('ch/5'); app.go(`ch/${SAMPLE.no}`);
    expect($$('.scenario .option')[0].classList.contains('chosen')).toBe(true);
    expect($('.scenario .reply').hidden).toBe(false);
    expect($('.scenario .reply').textContent).toBe('樣本回饋甲');
  });
  it('帶走的一句話照資料顯示', () => {
    expect($('.takeaway').textContent).toBe(SAMPLE.takeaway);
  });
  it('書裡每一頁的情境題都畫得出來：題目和三個選項與資料一致', () => {
    boot();
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect($('.scenario .prompt').textContent, ch.id).toBe(ch.scenario.prompt);
      expect(texts('.scenario .option'), ch.id).toEqual(ch.scenario.options.map((o) => o.text));
      $$('.scenario .option')[2].click();
      expect($('.scenario .reply').textContent, ch.id).toBe(ch.scenario.options[2].reply);
    }
  });
});

describe('難詞註解', () => {
  beforeEach(() => { boot({ book: sample }); app.go(`ch/${SAMPLE.no}`); });

  it('點難詞出現註解，再點一次收起來', () => {
    const term = $$('.lamp-row .term').find((b) => b.textContent === SAMPLE.rowTerm);
    expect(term).toBeTruthy();
    term.click();
    expect($('.gloss-note:not([hidden])').textContent).toContain('治獄');
    expect($('.gloss-note:not([hidden])').textContent).toContain('樣本註解：審理案件。');
    term.click();
    expect($('.gloss-note:not([hidden])')).toBeNull();
  });
  it('同一段點另一個詞，註解換成新的', () => {
    const first = $('.passage');
    const terms = [...first.querySelectorAll('.term')];
    expect(terms.map((t) => t.textContent)).toEqual(SAMPLE.passageTerms);
    expect(terms.map((t) => t.textContent)).toEqual(['於是', '訓']);
    terms[0].click();
    terms[1].click();
    const open = [...first.querySelectorAll('.gloss-note:not([hidden])')];
    expect(open).toHaveLength(1);
    expect(open[0].textContent).toContain('樣本註解：教導的話。');
    expect(open[0].textContent).not.toContain('接著、然後');
    expect(terms[0].getAttribute('aria-expanded')).toBe('false');
    expect(terms[1].getAttribute('aria-expanded')).toBe('true');
  });
  it('註解按鈕不會改動原文', () => {
    const [passage, list] = sample.chapters[SAMPLE.no - 1].blocks;
    expect($('.passage .raw').textContent).toBe(passage.raw);
    expect($('.passage .raw').textContent).toBe('於是訓於人曰：');
    expect(texts('.lamp-row .raw')).toEqual(list.items.map((it) => it.raw));
    expect(texts('.lamp-row .raw')[0]).toBe('昔于公治獄，大興駟馬之門；');
  });
  it('段落的白話照資料顯示', () => {
    expect($('.passage .plain').textContent).toBe(SAMPLE.passagePlain);
  });
});

describe('朗讀', () => {
  it('瀏覽器不支援時，沒有朗讀鈕', () => {
    app.go('ch/3');
    expect($('.btn-speak')).toBeNull();
  });
  it('支援時，按下去一句一句唸這一頁的原文；再按一次停止', () => {
    const { speech, spoken } = fakeSpeech();
    boot({ speech });
    app.go('ch/1');
    const btn = $('.btn-speak');
    btn.click();
    expect(spoken[0].text).toBe('帝君曰：吾一十七世為士大夫身，未嘗虐民酷吏；');
    expect(spoken.map((u) => u.text).join('')).toBe(chapterRaw(book.chapters[0]));
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    btn.click();
    expect(speech.isSpeaking()).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
  it('只有清單的頁也唸得出來', () => {
    const { speech, spoken } = fakeSpeech();
    boot({ speech });
    app.go('ch/7');
    $('.btn-speak').click();
    expect(spoken[0].text).toBe('或買物而放生，或持齋而戒殺。');
    expect(spoken.map((u) => u.text).join('')).toBe(chapterRaw(book.chapters[6]));
    expect(speech.isSpeaking()).toBe(true);
  });
  it('翻到別頁就停止朗讀', () => {
    const { speech } = fakeSpeech();
    boot({ speech });
    app.go('ch/3');
    $('.btn-speak').click();
    expect(speech.isSpeaking()).toBe(true);
    app.go('ch/4');
    expect(speech.isSpeaking()).toBe(false);
  });
});

describe('古今對照', () => {
  const { pairs } = book.match;
  const rightOf = (left) => $$('.match-right button').find((r) => r.dataset.key === left.dataset.key);
  const pairAll = () => {
    for (const left of $$('.match-left button')) {
      left.click();
      rightOf(left).click();
    }
  };
  it('左右各八個：左邊是原文和白話，右邊是今天做得到的事（順序打亂）', () => {
    app.go('match');
    expect($('.match h1').textContent).toBe('古今對照');
    expect($('.match .lead').textContent).toBe(book.match.lead);
    expect($$('.match-left button')).toHaveLength(8);
    expect($$('.match-right button')).toHaveLength(8);
    expect(texts('.match-left .match-name')).toEqual(pairs.map((p) => p.raw));
    expect(texts('.match-left .match-sub')).toEqual(pairs.map((p) => p.plain));
    expect(texts('.match-right .match-now').sort()).toEqual(pairs.map((p) => p.now).sort());
    // 右邊每一顆配的是資料裡同一組的例子，而且只寫例子：不能把原文也寫在上面（那就不用猜了）
    for (const b of $$('.match-right button')) {
      const pair = pairs.find((p) => p.id === b.dataset.key);
      expect(b.textContent).toBe(pair.now);
      expect(b.querySelector('.match-name')).toBeNull();
    }
  });
  it('點左邊的一句：問它換成今天是哪一件事', () => {
    app.go('match');
    const left = $$('.match-left button')[2];
    left.click();
    expect(left.classList.contains('selected')).toBe(true);
    expect($('.match-msg').textContent).toBe(`「${pairs[2].raw}」換成今天，是哪一件事？`);
    $$('.match-left button')[3].click(); // 改選另一句：只會有一個被選著
    expect($$('.match-left .selected')).toHaveLength(1);
    expect($('.match-msg').textContent).toBe(`「${pairs[3].raw}」換成今天，是哪一件事？`);
  });
  it('配對正確：兩邊都鎖住，訊息寫出這一組', () => {
    app.go('match');
    const left = $$('.match-left button')[0];
    left.click();
    const right = rightOf(left);
    right.click();
    expect(left.disabled).toBe(true);
    expect(right.disabled).toBe(true);
    expect(left.classList.contains('matched')).toBe(true);
    expect(right.classList.contains('matched')).toBe(true);
    expect($('.match-msg').textContent).toBe(`${pairs[0].raw} ↔ ${pairs[0].now}`);
    expect(store.isMatchDone()).toBe(false); // 才配了一組
  });
  it('配對錯誤：不鎖，可以再試', () => {
    app.go('match');
    const left = $$('.match-left button')[0];
    left.click();
    const wrong = $$('.match-right button').find((r) => r.dataset.key !== left.dataset.key);
    wrong.click();
    expect(left.disabled).toBe(false);
    expect(wrong.disabled).toBe(false);
    expect($('.match-msg').textContent).toBe('不是這一件，再想想。翻回前面看一眼也可以。');
    expect(wrong.classList.contains('shake')).toBe(true);
    expect($$('.matched')).toHaveLength(0);
    expect(store.isMatchDone()).toBe(false);
    rightOf(left).click(); // 左邊那一句還選著，直接再點對的就行
    expect(left.disabled).toBe(true);
  });
  it('八組全對：顯示完成並記錄，可以直接去看「我的福田」', () => {
    app.go('match');
    expect($('.match-done').hidden).toBe(true);
    for (const left of $$('.match-left button').slice(0, 7)) { left.click(); rightOf(left).click(); }
    expect($('.match-done').hidden).toBe(true); // 還差一組
    expect(store.isMatchDone()).toBe(false);
    const last = $$('.match-left button')[7];
    last.click();
    rightOf(last).click();
    expect($('.match-done').hidden).toBe(false);
    expect($('.match-done').textContent).toContain(book.match.done);
    expect($('.match-msg').textContent).toBe('');
    expect(store.isMatchDone()).toBe(true);
    expect($('.match-done button').textContent).toBe('去看「我的福田」');
    $('.match-done button').click();
    expect(window.location.hash).toBe('#/land');
    expect($$('.land-tile')[10].classList.contains('clear')).toBe(true); // 「古今對照」那一塊田開了
  });
  it('完成過之後再進來：說明已經完成過，盤面重新開始，可以再玩一次', () => {
    app.go('match');
    expect(text()).not.toContain('你已經完成過這個配對');
    pairAll();
    app.go('ch/11'); app.go('match');
    expect(text()).toContain('你已經完成過這個配對，想再玩一次也可以。');
    expect($$('.matched')).toHaveLength(0);
    expect($('.match-done').hidden).toBe(true);
    expect(store.isMatchDone()).toBe(true);
  });
  it('沒先選左邊就點右邊，不會出錯', () => {
    app.go('match');
    expect(() => $$('.match-right button')[0].click()).not.toThrow();
    expect($$('.matched')).toHaveLength(0);
    expect($('.match-msg').textContent).toBe('先點左邊的一句原文，再點右邊。');
  });
});

describe('我的福田', () => {
  const tiles = () => { app.go('land'); return $$('.land-tile'); };

  it('還沒有進度：十二塊都是還沒開的田，寫著十一段的名字和「古今對照」，照翻頁的順序排', () => {
    app.go('land');
    expect($('.land h1').textContent).toBe('我的福田');
    expect($$('.land-tile')).toHaveLength(12);
    expect($$('.land-tile.soil')).toHaveLength(12);
    expect($$('.land-tile.clear')).toHaveLength(0);
    expect(texts('.land-tile')).toEqual(PLOT_NAMES);
    expect($$('.land-tile').map((t) => t.getAttribute('aria-label'))).toEqual(PLOT_NAMES.map((name) => `${name}：還沒開，前往這一頁`));
    expect($('.land-count').textContent).toContain('已開 0／12 塊田');
    expect($('.land-count').textContent).toContain('種子 0／60');
    expect($('.land-complete').hidden).toBe(true);
    expect($$('.land > .hint')).toHaveLength(1);
  });
  it('圖用的是 config 的 LAND_ART（不屬於任何一頁）', () => {
    app.go('land');
    expect($('.land-frame img').getAttribute('src')).toBe(`assets/art/${LAND_ART}`);
    expect(book.chapters.map((c) => c.art)).not.toContain(LAND_ART);
  });
  it('landPlots：十二塊田＝十一段＋古今對照，照翻頁的順序；開了幾塊和 state.js 的 plotsDone、book.js 的 plotCount 算的一致', () => {
    const ctx = { book, store };
    expect(landPlots(ctx).map((p) => p.route)).toEqual(pages(book.chapters).filter((r) => r !== 'land'));
    expect(landPlots(ctx).map((p) => p.name)).toEqual(PLOT_NAMES);
    expect(landPlots(ctx)).toHaveLength(plotCount(book.chapters));
    const opened = () => landPlots(ctx).filter((p) => p.clear);
    expect(opened()).toEqual([]);
    store.markSeen('ch01'); lightPage(8); store.setMatchDone();
    store.markSeen('ch05'); store.lightLamp('ch05', 0); // 有種子的段只翻過、只種了一顆，不算
    expect(opened().map((p) => p.name)).toEqual(['帝君自述', '十勿', '古今對照']);
    expect(opened()).toHaveLength(store.plotsDone(book.chapters));
    finishChapters();
    expect(opened()).toHaveLength(12);
    expect(store.plotsDone(book.chapters)).toBe(12);
  });
  it('沒有種子的段，讀過就開那一塊', () => {
    app.go('ch/1');
    const t = tiles();
    expect(t[0].classList.contains('clear')).toBe(true);
    expect(t[0].classList.contains('soil')).toBe(false);
    expect(t[0].disabled).toBe(true);
    expect(t[0].textContent).toBe('');
    expect(t[0].getAttribute('aria-label')).toBe('帝君自述：已經開花');
    expect($$('.land-tile.soil')).toHaveLength(11);
    expect($('.land-count').textContent).toContain('已開 1／12 塊田');
  });
  it('有種子的段要把種子全部種下才開：光是翻到過不算', () => {
    app.go('ch/5');
    expect(tiles()[4].classList.contains('soil')).toBe(true);
    lampList(book.chapters[4]).items.slice(0, 11).forEach((_, i) => store.lightLamp('ch05', i));
    expect(tiles()[4].classList.contains('soil')).toBe(true); // 還差一顆
    expect($('.land-count').textContent).toContain('已開 0／12 塊田');
    lightPage(5);
    expect(tiles()[4].classList.contains('clear')).toBe(true);
    expect($('.land-count').textContent).toContain('已開 1／12 塊田');
    expect($('.land-count').textContent).toContain('種子 12／60');
  });
  it('「古今對照」那一塊要配對完成才開：光是翻到過不算', () => {
    app.go('match');
    expect(tiles()[10].classList.contains('soil')).toBe(true);
    expect(tiles()[10].textContent).toBe('古今對照');
    expect($('.land-count').textContent).toContain('已開 0／12 塊田');
    store.setMatchDone();
    expect(tiles()[10].classList.contains('clear')).toBe(true);
    expect(tiles()[10].getAttribute('aria-label')).toBe('古今對照：已經開花');
    expect($('.land-count').textContent).toContain('已開 1／12 塊田');
    expect($('.land-count').textContent).toContain('種子 0／60');
  });
  it('點還沒開的田，前往那一頁；「古今對照」那一塊前往配對', () => {
    tiles()[4].click();
    expect(window.location.hash).toBe('#/ch/5');
    tiles()[9].click();
    expect(window.location.hash).toBe('#/ch/10');
    tiles()[10].click();
    expect(window.location.hash).toBe('#/match');
    tiles()[11].click(); // 最後一塊是第 11 段〈結語〉：田比段多一塊，位置和頁次差一格
    expect(window.location.hash).toBe('#/ch/11');
  });
  it('十二塊全開：格子拿掉，顯示〈心地福田〉的第一句原文與白話', () => {
    finishChapters();
    store.setMatchDone();
    app.go('land');
    expect($$('.land-tile')).toHaveLength(0);
    expect($('.land-count').textContent).toContain('已開 12／12 塊田');
    expect($('.land-count').textContent).toContain('種子 60／60');
    expect($('.land-complete').hidden).toBe(false);
    const root3 = book.chapters[2].blocks[0];
    expect(book.chapters[2].title).toBe('心地福田');
    expect($('.land-complete .raw-line').textContent).toBe(root3.raw);
    expect($('.land-complete .raw-line').textContent).toBe('欲廣福田，須憑心地。');
    expect($('.land-complete .plain').textContent).toBe(root3.plain);
    expect($('.land-thanks').textContent).toContain('十二塊田都開了');
    expect($$('.land > .hint')).toHaveLength(0); // 全開之後不再提示怎麼開田
  });
  it('十一段都讀完，只差「古今對照」，就還不算全開', () => {
    finishChapters();
    app.go('land');
    expect($$('.land-tile.soil')).toHaveLength(1);
    expect($$('.land-tile.soil')[0].textContent).toBe('古今對照');
    expect($('.land-count').textContent).toContain('已開 11／12 塊田');
    expect($('.land-count').textContent).toContain('種子 60／60');
    expect($('.land-complete').hidden).toBe(true);
  });
  it('只差一段沒讀完，就還不算全開', () => {
    finishChapters(3); // 〈心地福田〉還沒讀
    store.setMatchDone();
    app.go('land');
    expect($$('.land-tile.soil')).toHaveLength(1);
    expect($$('.land-tile.soil')[0].textContent).toBe('心地福田');
    expect($('.land-complete').hidden).toBe(true);
  });
  it('下面有前往「每日種福」和目錄的按鈕；上一頁是第 11 頁〈結語〉，沒有下一頁', () => {
    app.go('land');
    expect(texts('.land-actions button')).toEqual(['每日種福', '目錄']);
    expect($('[data-action="next"]')).toBeNull();
    expect($('[data-action="prev"]').textContent).toBe('‹ 結語');
    $('[data-action="prev"]').click();
    expect(window.location.hash).toBe('#/ch/11');
    app.go('land');
    $('.land-actions button').click();
    expect(window.location.hash).toBe('#/daily');
  });
});

describe('每日種福', () => {
  it('三項，勾一項計數變 1／3', () => {
    app.go('daily');
    expect($('.daily h1').textContent).toBe('每日種福');
    const boxes = $$('.daily-item input[type="checkbox"]');
    expect(boxes).toHaveLength(3);
    expect(texts('.daily-name')).toEqual(book.daily.items.map((it) => it.name));
    expect(texts('.daily-name')).toEqual(['利人', '利物', '陰功']);
    expect(texts('.daily-ask')).toEqual(book.daily.items.map((it) => it.ask));
    expect($('.daily-quote').textContent).toBe(book.daily.quote);
    expect($('.daily-count').textContent).toContain('0／3');
    boxes[0].click();
    expect($('.daily-count').textContent).toContain('1／3');
    expect(daily.today()[0]).toBe(true);
  });
  it('顯示今天的日期與最近七天；每一天做到幾件寫在 aria-label', () => {
    app.go('daily');
    expect(text()).toContain('2026 年 11 月 18 日');
    expect($$('.daily-day')).toHaveLength(7);
    expect($('.daily-day.today').getAttribute('aria-label')).toBe('11 月 18 日：沒有紀錄');
    $$('.daily-item input')[0].click();
    $$('.daily-item input')[1].click();
    expect($('.daily-day.today').getAttribute('aria-label')).toBe('11 月 18 日：2 件');
  });
  it('離開再回來，勾過的還在', () => {
    app.go('daily');
    $$('.daily-item input')[2].click();
    app.go('toc'); app.go('daily');
    expect($$('.daily-item input')[2].checked).toBe(true);
  });
  it('結語跟著今天勾了幾項換：還沒勾、勾了一些、三項全勾', () => {
    app.go('daily');
    const boxes = $$('.daily-item input');
    expect($('.daily-closing').textContent).toBe(book.daily.closing.none);
    boxes[0].click();
    expect($('.daily-closing').textContent).toBe(book.daily.closing.some);
    boxes[1].click(); boxes[2].click();
    expect($('.daily-count').textContent).toContain('3／3');
    expect($('.daily-closing').textContent).toBe(book.daily.closing.all);
  });
  it('累積幾件：勾了就加、取消就減，下面附一句說明', () => {
    app.go('daily');
    expect($('.daily-total').textContent).toBe('累積 0 件');
    expect($('.daily-sum-note').textContent).toBe(book.daily.totalNote);
    $$('.daily-item input')[0].click();
    $$('.daily-item input')[1].click();
    expect($('.daily-total').textContent).toBe('累積 2 件');
    $$('.daily-item input')[1].click();
    expect($('.daily-total').textContent).toBe('累積 1 件');
  });
  it('累積的數字包含以前的日子，和已經不留明細的舊紀錄（archived）', () => {
    const dailyStorage = memoryStorage({
      [DAILY_KEY]: JSON.stringify({ v: 1, days: { '2026-11-16': [true, true, false], '2026-11-17': [true, false, false] }, archived: 40 }),
    });
    boot({ dailyStorage });
    app.go('daily');
    expect($('.daily-total').textContent).toBe('累積 43 件');
    $$('.daily-item input')[2].click();
    expect($('.daily-total').textContent).toBe('累積 44 件');
  });
  it('下面有回目錄和「我的福田」的按鈕', () => {
    app.go('daily');
    expect(texts('.daily .land-actions button')).toEqual(['目錄', '我的福田']);
    $$('.daily .land-actions button')[1].click();
    expect(window.location.hash).toBe('#/land');
  });
});

describe('目錄與關於', () => {
  it('目錄列出十一頁與其他頁，點了會過去', () => {
    app.go('toc');
    expect($$('.toc-chapter')).toHaveLength(11);
    for (const s of ['古今對照', '我的福田', '每日種福', '關於本書']) expect(text(), s).toContain(s);
    expect(texts('.toc-row .toc-title')).toEqual([...PLOT_NAMES, '我的福田', '每日種福', '關於本書']);
    $$('.toc-chapter')[6].click();
    expect(window.location.hash).toBe('#/ch/7');
    for (const [title, route] of [['我的福田', 'land'], ['每日種福', 'daily'], ['關於本書', 'about']]) {
      app.go('toc');
      $$('.toc-row').find((row) => row.querySelector('.toc-title').textContent === title).click();
      expect(window.location.hash, title).toBe(`#/${route}`);
    }
  });
  it('目錄的段次是一到十一，頁名、副題照資料', () => {
    app.go('toc');
    expect(texts('.toc-chapter .toc-no')).toEqual(['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一']);
    expect(texts('.toc-chapter .toc-title')).toEqual(book.chapters.map(chapterTitle));
    expect(texts('.toc-chapter .toc-sub')).toEqual(book.chapters.map((c) => c.subtitle));
  });
  it('目錄的小標和第一頁「全篇十一段」的分組一致，最後另有「其他」', () => {
    app.go('toc');
    expect(texts('.toc-section')).toEqual([...OVERVIEW_GROUPS.map(([title]) => title), '其他']);
    // 每個小標後面緊接著的，是那一組的第一段
    OVERVIEW_GROUPS.forEach(([title, parts]) => {
      const h = $$('.toc-section').find((n) => n.textContent === title);
      expect(h.nextElementSibling.querySelector('.toc-title').textContent, title).toBe(PARTS[parts[0] - 1]);
    });
  });
  it('「古今對照」排在第 10 頁〈修路造橋〉後面，點了會過去', () => {
    app.go('toc');
    expect(texts('.toc-row .toc-title').slice(9, 12)).toEqual(['修路造橋', '古今對照', '結語']);
    expect($$('.toc-row')[10].querySelector('.toc-mark')).toBeNull(); // 還沒配對完成，不標
    $$('.toc-row')[10].click();
    expect(window.location.hash).toBe('#/match');
    store.setMatchDone();
    app.go('toc');
    expect($$('.toc-row')[10].querySelector('.toc-mark').textContent).toBe('完成');
  });
  it('目錄顯示各頁的進度：有種子的頁是種下幾顆，沒有種子的頁是讀過了沒', () => {
    store.lightLamp('ch05', 0); store.lightLamp('ch05', 1);
    app.go('ch/3');
    app.go('toc');
    expect($$('.toc-chapter')[4].querySelector('.toc-mark').textContent).toBe('2／12');
    expect($$('.toc-chapter')[4].querySelector('.toc-mark').classList.contains('done')).toBe(false);
    expect($$('.toc-chapter')[2].querySelector('.toc-mark').textContent).toBe('已讀');
    expect($$('.toc-chapter')[3].querySelector('.toc-mark')).toBeNull(); // 還沒讀的頁不標
    expect($$('.toc-chapter')[5].querySelector('.toc-mark').textContent).toBe('0／8');
    expect($$('.toc-chapter')[1].querySelector('.toc-mark').textContent).toBe('0／4');
    lightPage(5);
    app.go('toc');
    expect($$('.toc-chapter')[4].querySelector('.toc-mark').textContent).toBe('12／12');
    expect($$('.toc-chapter')[4].querySelector('.toc-mark').classList.contains('done')).toBe(true);
  });
  it('目錄上「我的福田」那一列寫著已經開了幾塊田', () => {
    const landSub = () => { app.go('toc'); return $$('.toc-row').find((row) => row.querySelector('.toc-title').textContent === '我的福田').querySelector('.toc-sub').textContent; };
    expect(landSub()).toBe('已開 0／12 塊田');
    app.go('ch/1');
    expect(landSub()).toBe('已開 1／12 塊田');
    lightPage(8); store.setMatchDone();
    expect(landSub()).toBe('已開 3／12 塊田');
  });
  it('關於本書：有底本、註解依據、流通與 AI 插圖的說明', () => {
    app.go('about');
    for (const s of ['通行本', '636 字', '維基文庫', '陰隲文註', '文昌帝君陰騭文廣義節錄', '三聖經', '公有領域', '非營利', 'AI', '不會上傳']) {
      expect(text(), s).toContain(s);
    }
    // 本書從通行本的幾處用字（fidelity.test.js 釘住的是同一組）：說「甲」別的本子作「乙」的時候，
    // 甲要是書裡真的有的字，乙要是書裡沒有的（沒有寫反）
    const all = book.chapters.map(chapterRaw).join('');
    for (const [ours, other] of [['捐貲', '捐資'], ['毋侮聖言', '聖賢'], ['名利', '名節'], ['網禽鳥', '網禽獸']]) {
      expect(text(), `${ours}／${other}`).toMatch(new RegExp(`「${ours}」[^「」，。]{1,8}作「${other}」`));
      expect(all, ours).toContain(ours);
      expect(all, other).not.toContain(other);
    }
    expect(text()).toContain('本書一律從通行本');
    // 帶著時代背景的句子怎麼處理（data.test.js 守的是資料裡真的有註明）
    expect(text()).toContain('註明背景');
  });
  it('關於本書：說通行本比古註本多出來的那七處，引的都是書裡原文的句子，字數也對得上', () => {
    app.go('about');
    const all = book.chapters.map(chapterRaw).join('');
    const han = (s) => [...s.replace(/[，。；：、！？\s]/g, '')].length;
    const p = $$('.about p').find((n) => n.textContent.includes('這七處'));
    const quotes = (s) => [...s.matchAll(/「([^」]+)」/g)].map((m) => m[1]);
    // 這一段裡每一個引號引的都是原文，連標點都要一樣
    expect(quotes(p.textContent).length).toBeGreaterThanOrEqual(7);
    for (const q of quotes(p.textContent)) expect(all, q).toContain(q);
    // 「這七處：」後面連著的七個引號
    const seven = quotes(/^(?:「[^」]+」)+/.exec(p.textContent.split('這七處：')[1])[0]);
    expect(seven).toHaveLength(7);
    // 通行本 636 字，少掉這七處是 544 字；只少「和睦夫婦…毋侮聖言」十六個字的本子是 620 字
    expect(SOURCE.chars - seven.reduce((n, q) => n + han(q), 0)).toBe(544);
    expect(p.textContent).toContain('五百四十四字');
    const sixteen = seven.find((q) => q.startsWith('和睦夫婦'));
    expect(han(sixteen)).toBe(16);
    expect(SOURCE.chars - han(sixteen)).toBe(620);
    expect(p.textContent).toContain('六百二十字');
    expect(p.textContent).toContain(`「${sixteen}」這十六個字`);
  });
  it('關於本書：底本與註本的連結都在，而且另開分頁', () => {
    app.go('about');
    const links = $$('.about-links a');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([SOURCE.baseUrl, SOURCE.zhuguiUrl]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://zh.wikisource.org/wiki/文昌帝君陰騭文',
      'https://zh.wikisource.org/wiki/陰隲文註',
    ]);
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });
  // 有沒有裝 Google Analytics 看 config.js 的 GA_MEASUREMENT_ID：沒裝就不能提，裝了就要照實說
  if (GA_MEASUREMENT_ID === '') {
    it('關於本書：還沒裝 Google Analytics，就不提它', () => {
      app.go('about');
      expect(text()).not.toContain('Google Analytics');
      expect(text()).not.toMatch(/Google|GA4/);
    });
  } else {
    it('關於本書：照實說明有用 Google Analytics 統計瀏覽，而且不包含閱讀紀錄', () => {
      app.go('about');
      expect(text()).toContain('Google Analytics');
      expect(text()).toMatch(/Google Analytics[^。]*不包含/);
    });
  }
  it('清除進度要按兩次才生效；每日種福的紀錄會留著', () => {
    store.lightLamp('ch05', 0);
    store.setMatchDone();
    daily.set(0, true);
    app.go('about');
    const btn = $('[data-action="reset"]');
    btn.click();
    expect(store.totalLit()).toBe(1);
    expect(btn.textContent).toBe('再按一次，確定清除');
    btn.click();
    expect(store.totalLit()).toBe(0);
    expect(store.isMatchDone()).toBe(false);
    expect(store.plotsDone(book.chapters)).toBe(0);
    expect($('.tb-lamps').textContent).toBe('種子 0／60');
    expect(daily.countToday()).toBe(1);
    expect(text()).toContain('「每日種福」的紀錄會留著');
    expect(text()).toContain('全書 60 顆');
  });
});

describe('整本書的用語', () => {
  // 這本書是從《太上感應篇》那本改過來的：燈改成種子、章改成段，「善惡對照／轉禍為福／每日三善」
  // 改成「古今對照／我的福田／每日種福」。畫面上（含 aria-label、分頁標題）不該再出現那一本的說法。
  // 規則寫的是那一本畫面上實際用過的句型，不會誤傷原文和白話（例如「點夜燈」「一盞燈」）
  const LEFTOVER = [
    /烏雲/, /轉禍為福/, /善惡對照/, /每日三善/, /圓滿/, /時時方便/, // 時時方便是這本的舊名（2026-11-26 改成每日種福）
    /燈 \d+／\d+/, /已點亮/, /第 \d+ 盞燈/, /等你點亮的燈/, /的燈全部點亮了/,
    /第[一二三四五六七八九十]+章/, /這一章/, /全篇十章/, /累積 \d+ 善/, /：\d+ 善/,
  ];
  // 插圖的放大鈕不看：它的 aria-label 是插圖說明（稿子的內容，不是畫面用語）
  const shown = () => [
    document.title,
    root.textContent,
    ...$$('[aria-label]').filter((n) => !n.classList.contains('zoom-btn')).map((n) => n.getAttribute('aria-label')),
  ].join('\n');
  const ROUTES = ['', 'toc', ...book.chapters.map((c) => `ch/${c.no}`), 'match', 'land', 'daily', 'about'];
  const scan = (label) => {
    for (const route of ROUTES) {
      app.go(route);
      const all = shown();
      for (const re of LEFTOVER) expect(re.test(all), `${label}｜${route || '封面'}｜${re}`).toBe(false);
    }
  };

  it('剛開始讀的時候，每一頁都沒有那一本的用語', () => {
    scan('剛開始');
  });
  it('全部讀完之後（種子種完、配對完成、每日種福勾過），每一頁也沒有', () => {
    finishChapters();
    store.setMatchDone();
    daily.set(0, true);
    scan('全部讀完');
  });
  it('每一頁的分頁標題都帶著這本書的書名', () => {
    for (const route of ROUTES) {
      app.go(route);
      expect(document.title, route || '封面').toContain('文昌帝君陰騭文');
    }
  });
});

describe('路由', () => {
  it('不存在的頁回封面（這本書只有 11 頁，沒有第 12、13 頁）', () => {
    for (const hash of ['#/ch/99', '#/ch/12', '#/ch/13', '#/ch/0', '#/xyz', '#/ch/abc']) {
      boot({ hash });
      expect($('.cover'), hash).toBeTruthy();
      expect($('.chapter'), hash).toBeNull();
    }
  });
  it('直接用網址進到某一頁', () => {
    boot({ hash: '#/ch/9' });
    expect($('.chapter h1').textContent).toBe('修身處世');
    boot({ hash: '#/ch/11' });
    expect($('.chapter h1').textContent).toBe('結語');
  });
  it('瀏覽器的上一頁（hashchange）會重畫', () => {
    app.go('ch/3');
    window.location.hash = '#/ch/4';
    window.dispatchEvent(new Event('hashchange'));
    expect($('.chapter h1').textContent).toBe('人倫敬信');
  });
  it('頁面標題跟著換', () => {
    app.go('ch/3');
    expect(document.title).toBe('心地福田｜文昌帝君陰騭文');
    app.go('ch/7');
    expect(document.title).toBe('愛惜物命｜文昌帝君陰騭文');
    app.go('land');
    expect(document.title).toBe('我的福田｜文昌帝君陰騭文');
    app.go('');
    expect(document.title).toBe('文昌帝君陰騭文｜互動電子書');
  });
});
