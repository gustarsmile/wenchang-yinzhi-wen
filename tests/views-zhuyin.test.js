// @vitest-environment happy-dom
// 「顯示注音」的開關：預設關；打開後原文的每個漢字右邊出現直式注音（課本那種）；其他互動（難詞、種子、朗讀、點圖放大）照常。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBookFromDisk, loadSampleBook, loadZhuyinFromDisk, SAMPLE, memoryStorage, brokenStorage } from './helpers/loadBook.js';
import { createApp } from '../js/app.js';
import { createStore } from '../js/state.js';
import { createDaily } from '../js/daily.js';
import { createSpeech } from '../js/speech.js';
import { createPrefs } from '../js/prefs.js';
import { chapterRaw, splitSentences, lampList } from '../js/book.js';
import { annotate, annotateForDisplay, isHan } from '../js/zhuyin.js';
import { rawWithTerms } from '../js/ui/gloss.js';
import { resetLayers } from '../js/ui/layer.js';
import { PREFS_KEY, SAVE_KEY, SOURCE } from '../js/config.js';

const book = loadBookFromDisk();
// 難詞、補充說明的互動用樣本書測（第 2 頁是測試自己準備的固定內容，見 helpers/loadBook.js）
const sample = loadSampleBook();
const zhuyin = loadZhuyinFromDisk();
const flush = () => new Promise((r) => setTimeout(r, 0));
const BOPOMOFO = /[ㄅ-ㄩ˙ˊˇˋ]/;

function fakeSpeech() {
  const spoken = [];
  class U { constructor(t) { this.text = t; } }
  const synth = { getVoices: () => [{ lang: 'zh-TW', name: 'v' }], speak: (u) => spoken.push(u), cancel() {} };
  return { speech: createSpeech({ synth, Utterance: U }), spoken };
}

let root; let store; let app; let prefsStorage;
function boot({
  book: which = book, data = zhuyin, storage = memoryStorage(), bookStorage = memoryStorage(),
  speech = createSpeech({ synth: undefined, Utterance: undefined }), hash = '',
} = {}) {
  app?.destroy();
  window.location.hash = hash;
  document.body.textContent = '';
  root = document.createElement('div');
  document.body.appendChild(root);
  prefsStorage = storage;
  store = createStore(bookStorage);
  app = createApp({
    root, book: which, store, speech,
    daily: createDaily(memoryStorage(), () => new Date(2026, 10, 18, 12)),
    zhuyin: data,
    prefs: createPrefs(storage),
    win: window,
  });
  app.render();
}
const $ = (sel) => root.querySelector(sel);
const $$ = (sel) => [...root.querySelectorAll(sel)];
const toggle = () => $('[data-action="toggle-zhuyin"]');
const hanCount = (s) => [...s].filter(isHan).length;
// 把注音（<rt>）拿掉之後剩下的字
function baseText(node) {
  const copy = node.cloneNode(true);
  copy.querySelectorAll('rt').forEach((rt) => rt.remove());
  return copy.textContent;
}
// 一段原文畫出來的每個字和它的注音：[['帝', 'ㄉㄧˋ'], ['君', 'ㄐㄩㄣ'], …]
const shownReadings = (node) => [...node.querySelectorAll('ruby')].map((r) => [baseText(r), r.querySelector('rt').textContent]);
const lb = () => document.querySelector('#lightbox');
const isOpen = () => !!lb()?.classList.contains('open');

beforeEach(() => {
  resetLayers();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(() => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })), 0);
  });
  boot();
});
afterEach(async () => {
  if (isOpen()) lb().click();
  app.destroy();
  resetLayers();
  await flush();
  vi.restoreAllMocks();
});

describe('注音開關', () => {
  it('每一頁的「經文」標題列都有一顆，和「朗讀」「白話」放在一起；預設是關的', () => {
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect($$('[data-action="toggle-zhuyin"]'), ch.id).toHaveLength(1);
      expect(toggle().closest('.sec-tools'), ch.id).toBeTruthy();
      expect(toggle().tagName, ch.id).toBe('BUTTON');
      expect(toggle().textContent, ch.id).toBe('注音：關');
      expect(toggle().getAttribute('aria-pressed'), ch.id).toBe('false');
    }
  });

  it('關著的時候畫面上沒有任何 ruby，原文和沒有這個功能時一模一樣', () => {
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect($$('ruby, rt'), ch.id).toHaveLength(0);
      expect($$('.sutra .raw').map((n) => n.textContent).join(''), ch.id).toBe(chapterRaw(ch));
      expect($('.sutra').classList.contains('zhuyin-on'), ch.id).toBe(false);
    }
  });

  it('打開：這一頁原文的每個漢字都變成 <ruby>字<rt>注音</rt></ruby>（注音拆成直排的一欄＋調號），標點不加', () => {
    app.go('ch/1');
    toggle().click();
    expect(toggle().textContent).toBe('注音：開');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect($('.sutra').classList.contains('zhuyin-on')).toBe(true);

    const first = $('.passage .raw');
    expect(baseText(first)).toMatch(/^帝君曰：/);
    const rubies = [...first.querySelectorAll('ruby')];
    expect(rubies.slice(0, 3).map((r) => r.outerHTML)).toEqual([
      '<ruby>帝<rt><span class="zy-col"><span>ㄉ</span><span>ㄧ</span></span><span class="zy-tone">ˋ</span></rt></ruby>',
      '<ruby>君<rt><span class="zy-col"><span>ㄐ</span><span>ㄩ</span><span>ㄣ</span></span></rt></ruby>', // 一聲不標調，就沒有調號那一格
      '<ruby>曰<rt><span class="zy-col"><span>ㄩ</span><span>ㄝ</span></span></rt></ruby>',
    ]);
    // 標點是 ruby 外面的純文字
    expect(rubies[2].nextSibling.nodeType).toBe(3);
    expect(rubies[2].nextSibling.textContent).toBe('：');
    for (const r of rubies) {
      expect(isHan(baseText(r)), r.outerHTML).toBe(true);
      expect(r.querySelectorAll('rt')).toHaveLength(1);
    }
  });

  it('十一頁都一樣：ruby 的數目等於那一頁的漢字數，字和注音都和資料對得上；拿掉注音，原文一字不差', () => {
    app.go('ch/1');
    toggle().click();
    expect(book.chapters).toHaveLength(11);
    let total = 0;
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      const raws = ch.blocks.flatMap((b) => (b.type === 'list' ? b.items : [b])).map((t) => t.raw);
      const nodes = $$('.sutra .raw');
      expect(nodes, ch.id).toHaveLength(raws.length);
      nodes.forEach((node, i) => {
        const raw = raws[i];
        expect(baseText(node), raw).toBe(raw);
        const want = annotateForDisplay(raw, zhuyin);
        const han = [...raw].map((c, k) => [c, want[k]]).filter(([c]) => isHan(c));
        expect(han.every(([, reading]) => typeof reading === 'string' && reading.length > 0), raw).toBe(true); // 每個字都有讀音
        expect(shownReadings(node), raw).toEqual(han);
      });
      expect($$('.sutra ruby'), ch.id).toHaveLength(hanCount(chapterRaw(ch)));
      total += $$('.sutra ruby').length;
    }
    expect(total).toBe(636);
    expect(total).toBe(SOURCE.chars);
  });

  it('畫面上顯示的是「一」「不」變調之後的讀音（資料裡存的是本調）', () => {
    app.go('ch/8');
    toggle().click();
    // 「不」在四聲前面讀二聲：不睦 ㄅㄨˊ ㄇㄨˋ
    const raw = '勿因小利，使人父子不睦。';
    const at = [...raw].indexOf('不');
    expect(annotate(raw, zhuyin).slice(at, at + 2)).toEqual(['ㄅㄨˋ', 'ㄇㄨˋ']);
    const node = $$('.sutra .raw').find((n) => baseText(n) === raw);
    expect(node, '第 8 頁找不到這一句').toBeTruthy();
    expect(shownReadings(node).slice(-2)).toEqual([['不', 'ㄅㄨˊ'], ['睦', 'ㄇㄨˋ']]);
    // 「一十七世」的「一」是十位上的一，讀本調，不變成四聲
    app.go('ch/1');
    const shown = shownReadings($('.passage .raw'));
    const one = shown.findIndex(([c]) => c === '一');
    expect(shown.slice(one, one + 4)).toEqual([['一', 'ㄧ'], ['十', 'ㄕˊ'], ['七', 'ㄑㄧ'], ['世', 'ㄕˋ']]);
  });

  it('再按一次關掉：ruby 全部拿掉，原文恢復原狀', () => {
    for (const no of [4, 2]) { // 只有段落的頁、段落和清單都有的頁
      app.go(`ch/${no}`);
      if (toggle().getAttribute('aria-pressed') === 'true') toggle().click();
      const before = $('.sutra').innerHTML;
      toggle().click();
      expect($$('ruby').length, `第 ${no} 頁`).toBeGreaterThan(0);
      toggle().click();
      expect(toggle().textContent, `第 ${no} 頁`).toBe('注音：關');
      expect(toggle().getAttribute('aria-pressed'), `第 ${no} 頁`).toBe('false');
      expect($$('ruby, rt'), `第 ${no} 頁`).toHaveLength(0);
      expect($$('.sutra .raw').map((n) => n.textContent).join(''), `第 ${no} 頁`).toBe(chapterRaw(book.chapters[no - 1]));
      expect($('.sutra').innerHTML, `第 ${no} 頁`).toBe(before);
    }
  });

  it('只有原文加注音：標題、導讀、白話、故事、註解、補充說明、情境題都不加', () => {
    boot({ book: sample });
    app.go(`ch/${SAMPLE.no}`);
    toggle().click();
    $$('.lamp')[SAMPLE.noteRow].click();       // 展開白話、故事和補充說明
    $('.passage .term').click();               // 打開一條註解
    $('.scenario .option').click();            // 選一個情境題的選項
    expect($$('ruby').length).toBeGreaterThan(0);
    expect($$('ruby').every((r) => r.closest('.raw'))).toBe(true);
    for (const sel of ['.ch-head', '.lead', '.plain', '.story', '.gloss-note', '.collation', '.scenario', '.takeaway', '.list-head', '.lamp-group', '.hint', '.pager']) {
      expect($(sel), sel).toBeTruthy();
      expect($$(sel).some((n) => BOPOMOFO.test(n.textContent)), sel).toBe(false);
    }
  });

  it('書裡第 2 頁的四則故事也不加注音：種下之後，ruby 還是只有原文那幾個字', () => {
    app.go('ch/2');
    toggle().click();
    $$('.lamp').forEach((l) => l.click());
    expect($$('.story')).toHaveLength(4);
    expect($$('.lamp-row .plain').every((p) => !p.hidden)).toBe(true);
    expect($$('.story ruby, .plain ruby')).toHaveLength(0);
    expect($$('.sutra ruby')).toHaveLength(hanCount(chapterRaw(book.chapters[1])));
    expect($$('.sutra ruby').every((r) => r.closest('.raw'))).toBe(true);
  });

  it('不是章節的頁面（封面、目錄、古今對照、我的福田、時時方便、關於）沒有開關，也沒有注音', () => {
    app.go('ch/1');
    toggle().click();
    for (const route of ['', 'toc', 'match', 'land', 'daily', 'about']) {
      app.go(route);
      expect(toggle(), route).toBeNull();
      expect($$('ruby'), route).toHaveLength(0);
    }
  });
});

describe('注音開關的狀態會被記住', () => {
  it('換頁之後還是開著', () => {
    app.go('ch/1');
    toggle().click();
    app.go('ch/7');
    expect(toggle().textContent).toBe('注音：開');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect($$('.sutra ruby')).toHaveLength(hanCount(chapterRaw(book.chapters[6])));
    app.go('toc');
    app.go('ch/2');
    expect($$('.sutra ruby').length).toBeGreaterThan(0);
  });

  it('關掉之後換頁，也還是關著', () => {
    app.go('ch/1');
    toggle().click();
    toggle().click();
    app.go('ch/2');
    expect(toggle().textContent).toBe('注音：關');
    expect($$('ruby')).toHaveLength(0);
  });

  it('重新開啟這本書（同一個瀏覽器的儲存空間）：一進來就是開的', () => {
    app.go('ch/1');
    toggle().click();
    const storage = prefsStorage;
    boot({ storage, hash: '#/ch/3' });
    expect(toggle().textContent).toBe('注音：開');
    expect($$('.sutra ruby')).toHaveLength(hanCount(chapterRaw(book.chapters[2])));
    toggle().click();
    boot({ storage, hash: '#/ch/3' });
    expect(toggle().textContent).toBe('注音：關');
    expect($$('ruby')).toHaveLength(0);
  });

  it('存在 localStorage 的 yinzhiPrefs.v1，和閱讀進度分開', () => {
    expect(PREFS_KEY).toBe('yinzhiPrefs.v1');
    expect(PREFS_KEY).not.toBe(SAVE_KEY);
    app.go('ch/1');
    expect(prefsStorage.getItem(PREFS_KEY)).toBeNull(); // 沒動過開關就不寫
    toggle().click();
    expect(JSON.parse(prefsStorage.getItem(PREFS_KEY))).toEqual({ v: 1, zhuyin: true });
    toggle().click();
    expect(JSON.parse(prefsStorage.getItem(PREFS_KEY))).toEqual({ v: 1, zhuyin: false });
  });

  it('同一個網域底下《太上感應篇》那本開了注音，這本不會跟著開（各存各的）', () => {
    boot({ storage: memoryStorage({ 'ganyingPrefs.v1': JSON.stringify({ v: 1, zhuyin: true }) }), hash: '#/ch/1' });
    expect(toggle().textContent).toBe('注音：關');
    expect($$('ruby')).toHaveLength(0);
  });

  it('「清除閱讀進度」不會把注音關掉（那是顯示的偏好，不是進度）', () => {
    app.go('ch/1');
    toggle().click();
    app.go('about');
    $('[data-action="reset"]').click();
    $('[data-action="reset"]').click();
    app.go('ch/1');
    expect(toggle().textContent).toBe('注音：開');
  });

  it('儲存空間不能用（無痕模式、被擋掉的 iframe）：照樣能開關，換頁也記得，只是重開不會留著', () => {
    boot({ storage: brokenStorage() });
    app.go('ch/1');
    expect(() => toggle().click()).not.toThrow();
    expect($$('.sutra ruby').length).toBeGreaterThan(0);
    app.go('ch/2');
    expect(toggle().textContent).toBe('注音：開');
  });

  it('沒有注音資料（zhuyin.json 讀不到）：沒有這顆開關，書照常能讀', () => {
    const storage = memoryStorage({ [PREFS_KEY]: JSON.stringify({ v: 1, zhuyin: true }) });
    boot({ data: null, storage });
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      expect(toggle(), ch.id).toBeNull();
      expect($$('ruby'), ch.id).toHaveLength(0);
      expect($$('.sutra .raw').map((n) => n.textContent).join(''), ch.id).toBe(chapterRaw(ch));
    }
  });
});

describe('開著注音時，難詞照常可以點', () => {
  beforeEach(() => {
    boot({ book: sample });
    app.go(`ch/${SAMPLE.no}`);
    toggle().click();
  });
  const termOf = (word) => $$('.term').find((t) => baseText(t) === word);

  it('難詞還是那幾個，位置不變，裡面的字也加了注音', () => {
    expect($$('.passage .term').map(baseText)).toEqual(SAMPLE.passageTerms);
    expect($$('.passage .term').map(baseText)).toEqual(['於是', '訓']);
    expect($$('.lamp-row .term').map(baseText)).toEqual([SAMPLE.rowTerm]);
    const term = termOf('治獄');
    expect(term.getAttribute('role')).toBe('button');
    expect([...term.querySelectorAll('ruby')].map((r) => r.outerHTML)).toEqual([
      '<ruby>治<rt><span class="zy-col"><span>ㄓ</span></span><span class="zy-tone">ˋ</span></rt></ruby>',
      '<ruby>獄<rt><span class="zy-col"><span>ㄩ</span></span><span class="zy-tone">ˋ</span></rt></ruby>',
    ]);
    // 三個符號疊成一欄的字也一樣
    expect([...termOf('訓').querySelectorAll('ruby')].map((r) => r.outerHTML)).toEqual([
      '<ruby>訓<rt><span class="zy-col"><span>ㄒ</span><span>ㄩ</span><span>ㄣ</span></span><span class="zy-tone">ˋ</span></rt></ruby>',
    ]);
  });
  it('點難詞出現註解，再點一次收起來', () => {
    const term = termOf('治獄');
    term.click();
    expect(term.getAttribute('aria-expanded')).toBe('true');
    expect($('.gloss-note:not([hidden])').textContent).toContain('樣本註解：審理案件。');
    expect(BOPOMOFO.test($('.gloss-note:not([hidden])').textContent)).toBe(false); // 註解框裡的詞不帶注音
    term.click();
    expect($('.gloss-note:not([hidden])')).toBeNull();
  });
  it('點在難詞的字上、或它上面的注音上，都算點到這個難詞', () => {
    const term = termOf('治獄');
    term.querySelector('ruby').click();
    expect(term.getAttribute('aria-expanded')).toBe('true');
    term.querySelector('rt').click();
    expect(term.getAttribute('aria-expanded')).toBe('false');
  });
  it('鍵盤一樣能開關', () => {
    const term = termOf('治獄');
    term.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(term.getAttribute('aria-expanded')).toBe('true');
    term.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(term.getAttribute('aria-expanded')).toBe('false');
  });
  it('點難詞（包括點在注音上）不會順便種下那顆種子', () => {
    const term = termOf('治獄');
    term.click();
    term.querySelector('rt').click();
    term.querySelector('ruby').click();
    expect(store.totalLit()).toBe(0);
    expect($$('.lamp-row .plain').every((p) => p.hidden)).toBe(true);
  });
  it('註解開著的時候開關注音：註解不會被關掉，再點那個詞照樣收得起來', () => {
    const term = termOf('於是');
    term.click();
    toggle().click(); // 關注音
    expect($('.passage .gloss-note').hidden).toBe(false);
    expect(termOf('於是')).toBe(term); // 還是同一個節點
    expect(term.getAttribute('aria-expanded')).toBe('true');
    expect(term.textContent).toBe('於是');
    toggle().click(); // 再開
    expect($('.passage .gloss-note').hidden).toBe(false);
    term.click();
    expect($('.passage .gloss-note').hidden).toBe(true);
  });
  it('真的資料：開著注音時，每一頁的難詞數和資料裡引用的一樣多，而且都點得開', () => {
    boot();
    app.go('ch/1');
    toggle().click();
    let total = 0;
    for (const ch of book.chapters) {
      app.go(`ch/${ch.no}`);
      const texts = ch.blocks.flatMap((b) => (b.type === 'list' ? b.items : [b]));
      const want = texts.flatMap((t) => (t.terms || []).map((key) => book.glossary[key].term));
      expect($$('.sutra .term').map(baseText).sort(), ch.id).toEqual([...want].sort());
      for (const term of $$('.sutra .term')) {
        term.click();
        expect(term.getAttribute('aria-expanded'), `${ch.id}｜${baseText(term)}`).toBe('true');
        term.click();
      }
      total += want.length;
    }
    expect(total).toBeGreaterThan(100);
    expect(store.totalLit()).toBe(0);
  });
});

describe('開著注音時，種子照常可以種', () => {
  beforeEach(() => {
    app.go('ch/5');
    toggle().click();
  });

  it('點種子：發芽、顯示白話、計數加一', () => {
    $$('.lamp')[0].click();
    expect($$('.lamp')[0].classList.contains('lit')).toBe(true);
    expect($$('.lamp-row .plain')[0].hidden).toBe(false);
    expect($('.lamp-count').textContent).toBe('已種下 1／12');
    expect(store.isLit('ch05', 0)).toBe(true);
  });
  // 不是難詞的字：直接掛在 .raw 底下的 ruby（難詞裡的字點了是開註解，不是種種子）
  const plainRuby = (row) => row.querySelector('.raw > ruby');
  it('點那一列的原文也會種下：點在字上、點在注音上都算', () => {
    const rows = $$('.lamp-row').filter(plainRuby);
    expect(rows.length).toBeGreaterThan(10);
    rows[0].querySelector('.raw-line').click();
    plainRuby(rows[1]).click();
    plainRuby(rows[2]).querySelector('rt').click();
    for (const row of rows.slice(0, 3)) {
      expect(row.querySelector('.lamp').classList.contains('lit')).toBe(true);
      expect(row.querySelector('.plain').hidden).toBe(false);
    }
    expect(store.litCount('ch05')).toBe(3);
  });
  it('一頁全部種下，照樣出現「開了一塊花田」的訊息', () => {
    $$('.lamp').forEach((l) => l.click());
    expect($('.lamps-done').hidden).toBe(false);
    expect($('.lamps-done').textContent).toContain('〈濟急救危〉的種子全部種下了');
    expect(store.isChapterComplete(book.chapters[4])).toBe(true);
  });
  it('開關注音不會動到已經種下的種子和展開的白話', () => {
    $$('.lamp')[0].click();
    toggle().click();
    expect($$('.lamp')[0].classList.contains('lit')).toBe(true);
    expect($$('.lamp-row .plain')[0].hidden).toBe(false);
    expect($$('.lamp.lit')).toHaveLength(1);
    toggle().click();
    expect($$('.lamp.lit')).toHaveLength(1);
    expect($$('.lamp-row .plain')[1].hidden).toBe(true);
  });
  it('其他有種子的頁（四個典故、第 6–10 頁）也都種得下', () => {
    const others = book.chapters.filter((c) => lampList(c) && c.no !== 5);
    expect(others.map((c) => c.no)).toEqual([2, 6, 7, 8, 9, 10]);
    for (const ch of others) {
      app.go(`ch/${ch.no}`);
      expect($$('.sutra ruby').length, ch.id).toBeGreaterThan(0);
      // 點那一列裡不是難詞的字；整列都是難詞的（少數），就點種子
      $$('.lamp-row').forEach((row) => (plainRuby(row) || row.querySelector('.lamp')).click());
      expect($$('.lamp.lit'), ch.id).toHaveLength($$('.lamp').length);
      expect($$('.lamp.lit'), ch.id).toHaveLength(lampList(ch).items.length);
      expect(store.isPartComplete(book.chapters, ch.part), ch.id).toBe(true);
    }
    expect(store.totalLit()).toBe(48); // 全書 60 顆，扣掉第 5 頁的 12 顆
  });
});

describe('開著注音時，其他功能照常', () => {
  it('朗讀唸的是資料裡的原文，不會把注音也唸出來', () => {
    const { speech, spoken } = fakeSpeech();
    boot({ speech });
    for (const no of [1, 2, 7]) { // 只有段落、段落加清單、只有清單
      app.go(`ch/${no}`);
      if (toggle().getAttribute('aria-pressed') !== 'true') toggle().click();
      spoken.length = 0;
      $('.btn-speak').click();
      const ch = book.chapters[no - 1];
      expect(spoken.map((u) => u.text)).toEqual(splitSentences(chapterRaw(ch)));
      expect(spoken.some((u) => BOPOMOFO.test(u.text)), `第 ${no} 頁`).toBe(false);
    }
  });
  // 注音欄是絕對定位的區塊，瀏覽器把選取的字轉成文字時會在每個字後面多塞一個換行。
  // 複製的那一刻先把注音藏起來再取文字，貼出去的就和沒開注音時一樣
  it('複製原文：貼出去的是乾淨的原文，沒有注音，也沒有多出來的換行', () => {
    app.go('ch/1');
    toggle().click();
    const sutra = $('.sutra');
    const seen = [];
    vi.spyOn(window, 'getSelection').mockImplementation(() => ({
      toString: () => { seen.push(sutra.classList.contains('zhuyin-copy')); return '廣行陰騭，上格蒼穹。'; },
    }));
    const copied = {};
    const e = new window.Event('copy', { bubbles: true, cancelable: true });
    e.clipboardData = { setData: (type, text) => { copied[type] = text; } };
    $('.passage .raw ruby').dispatchEvent(e);
    expect(seen).toEqual([true]);                                // 取文字的那一刻注音是藏著的
    expect(sutra.classList.contains('zhuyin-copy')).toBe(false); // 取完馬上恢復
    expect(copied).toEqual({ 'text/plain': '廣行陰騭，上格蒼穹。' });
    expect(e.defaultPrevented).toBe(true);
    expect($$('.sutra ruby').length).toBeGreaterThan(0);
  });
  it('清單裡的原文也一樣：開著注音複製一列，貼出去的是乾淨的原文', () => {
    app.go('ch/5');
    toggle().click();
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '濟急如濟涸轍之魚，' });
    const copied = {};
    const e = new window.Event('copy', { bubbles: true, cancelable: true });
    e.clipboardData = { setData: (type, text) => { copied[type] = text; } };
    $('.lamp-row .raw ruby').dispatchEvent(e);
    expect(copied).toEqual({ 'text/plain': '濟急如濟涸轍之魚，' });
    expect(e.defaultPrevented).toBe(true);
    expect(store.totalLit()).toBe(0); // 複製不會順便種下那一顆
  });
  it('沒開注音、或沒有選到字的時候，複製照瀏覽器原本的做法（不插手）', () => {
    app.go('ch/1');
    const fire = () => {
      const e = new window.Event('copy', { bubbles: true, cancelable: true });
      e.clipboardData = { setData: vi.fn() };
      $('.passage .raw').dispatchEvent(e);
      return e;
    };
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '廣行陰騭' });
    let e = fire(); // 注音是關的
    expect(e.defaultPrevented).toBe(false);
    expect(e.clipboardData.setData).not.toHaveBeenCalled();
    toggle().click();
    selection.mockReturnValue({ toString: () => '' });
    e = fire(); // 開著，但沒有選到字
    expect(e.defaultPrevented).toBe(false);
    expect(e.clipboardData.setData).not.toHaveBeenCalled();
  });
  it('白話照常可以收起來再打開', () => {
    app.go('ch/1');
    toggle().click();
    const plain = $('[data-action="toggle-plain"]');
    plain.click();
    expect($$('.passage .plain').every((p) => p.hidden)).toBe(true);
    expect($$('.sutra ruby').length).toBeGreaterThan(0);
    plain.click();
    expect($('.passage .plain').hidden).toBe(false);
  });
  it('點圖放大照常，關掉後回到同一頁，注音還在', () => {
    app.go('ch/3');
    toggle().click();
    $('.chapter .zoom-btn').click();
    expect(isOpen()).toBe(true);
    lb().click();
    expect(isOpen()).toBe(false);
    expect(window.location.hash).toBe('#/ch/3');
    expect($$('.sutra ruby').length).toBeGreaterThan(0);
  });
  it('上一頁、下一頁、鍵盤左右鍵照常翻頁', () => {
    app.go('ch/2');
    toggle().click();
    $('[data-action="next"]').click();
    expect(window.location.hash).toBe('#/ch/3');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(window.location.hash).toBe('#/ch/2');
  });
});

describe('rawWithTerms 的注音', () => {
  const block = book.chapters[0].blocks[0]; // 帝君曰：吾一十七世為士大夫身，未嘗虐民酷吏；（有幾個難詞）
  it('沒有給讀音：只有文字和難詞，textContent 就是原文', () => {
    const { node } = rawWithTerms(block.raw, block.terms, book.glossary);
    expect(node.textContent).toBe(block.raw);
    expect(node.querySelectorAll('ruby')).toHaveLength(0);
    expect(node.querySelectorAll('.term')).toHaveLength(block.terms.length);
    expect(block.terms.length).toBeGreaterThan(0);
  });
  it('setReadings(讀音) 加上注音，setReadings(null) 拿掉；難詞的節點不換', () => {
    const { node, setReadings } = rawWithTerms(block.raw, block.terms, book.glossary);
    const plain = node.innerHTML;
    const terms = [...node.querySelectorAll('.term')];
    expect(terms.length).toBeGreaterThan(0);
    setReadings(annotate(block.raw, zhuyin));
    expect(node.querySelectorAll('ruby')).toHaveLength(hanCount(block.raw));
    expect(baseText(node)).toBe(block.raw);
    expect([...node.querySelectorAll('.term')]).toEqual(terms);
    setReadings(null);
    expect(node.innerHTML).toBe(plain);
    expect([...node.querySelectorAll('.term')]).toEqual(terms);
  });
  // 直式注音：聲母、介音、韻母一個符號一格由上往下疊；二三四聲的調號另外一格，排在這一欄的右邊；輕聲的點在最上面
  it('注音排成直的：符號一個一格疊成一欄，調號拆出來放在欄的右邊，輕聲的點放在欄的最上面', () => {
    const { node, setReadings } = rawWithTerms('你好的啊', [], {});
    setReadings(['ㄋㄧˇ', 'ㄏㄠˇ', '˙ㄉㄜ', 'ㄚ']);
    const [ni, hao, de, a] = [...node.querySelectorAll('ruby')];
    const cells = (r) => [...r.querySelector('.zy-col').children].map((c) => c.textContent);
    expect(cells(ni)).toEqual(['ㄋ', 'ㄧ']);
    expect(cells(hao)).toEqual(['ㄏ', 'ㄠ']);
    expect(ni.querySelector('.zy-tone').textContent).toBe('ˇ');
    expect(ni.querySelector('rt').lastElementChild.className).toBe('zy-tone'); // 調號在欄的後面（畫面上是右邊）
    expect(ni.querySelector('.zy-col .zy-tone')).toBeNull();                    // 不在欄裡面
    expect(cells(de)).toEqual(['˙', 'ㄉ', 'ㄜ']);
    expect(de.querySelector('.zy-col').firstElementChild.className).toBe('zy-dot');
    expect(de.querySelector('.zy-tone')).toBeNull();
    expect(cells(a)).toEqual(['ㄚ']);
    expect(a.querySelector('.zy-tone')).toBeNull();
    // 拆開來排，但 <rt> 的文字還是資料裡的寫法（輕聲在前、調號在後）
    expect([...node.querySelectorAll('rt')].map((rt) => rt.textContent)).toEqual(['ㄋㄧˇ', 'ㄏㄠˇ', '˙ㄉㄜ', 'ㄚ']);
  });
  it('整本書：每個字的注音欄最多三格（聲母、介音、韻母），調號最多一個', () => {
    let checked = 0;
    for (const ch of book.chapters) {
      for (const t of ch.blocks.flatMap((b) => (b.type === 'list' ? b.items : [b]))) {
        const { node, setReadings } = rawWithTerms(t.raw, t.terms, book.glossary);
        setReadings(annotate(t.raw, zhuyin));
        for (const rt of node.querySelectorAll('rt')) {
          const n = rt.querySelector('.zy-col').children.length;
          expect(n >= 1 && n <= 3, `${t.raw}｜${rt.textContent}`).toBe(true);
          expect(rt.querySelectorAll('.zy-tone').length).toBeLessThanOrEqual(1);
          expect(rt.children.length).toBeLessThanOrEqual(2);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(636); // 全書每一個漢字都檢查到了
  });
  it('某個字沒有讀音（資料缺漏）：那個字照原樣顯示，不加空的 ruby', () => {
    const { node, setReadings } = rawWithTerms('帝君曰：', [], {});
    setReadings(['ㄉㄧˋ', null, 'ㄩㄝ', null]);
    expect(node.innerHTML).toBe('<ruby>帝<rt><span class="zy-col"><span>ㄉ</span><span>ㄧ</span></span><span class="zy-tone">ˋ</span></rt></ruby>君<ruby>曰<rt><span class="zy-col"><span>ㄩ</span><span>ㄝ</span></span></rt></ruby>：');
  });
});
