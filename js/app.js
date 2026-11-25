// 組裝：依 hash 路由畫出對應的頁面，並管理頂列、翻頁鍵與滑動手勢。
import { parseRoute, toHash } from './router.js';
import { pages, nextRoute, prevRoute, chapterTitle } from './book.js';
import { BOOK_TITLE, BOOK_SHORT_TITLE, TOTAL_LAMPS, LAND_ART, SAVE_KEY, DAILY_KEY, PREFS_KEY } from './config.js';
import { el, button, append } from './ui/dom.js';
import { hasOpenLayer } from './ui/layer.js';
import { createPrefs } from './prefs.js';
import { renderCover } from './ui/coverView.js';
import { renderToc } from './ui/tocView.js';
import { renderChapter } from './ui/chapterView.js';
import { renderMatch } from './ui/matchView.js';
import { renderLand } from './ui/landView.js';
import { renderDaily } from './ui/dailyView.js';
import { renderAbout } from './ui/aboutView.js';

const FIXED_TITLES = { toc: '目錄', match: '古今對照', land: '我的福田', daily: '時時方便', about: '關於本書' };

// 滑動翻頁的門檻
const SWIPE_MIN_X = 90;      // 水平至少滑這麼多
const SWIPE_RATIO = 2.5;     // 水平位移要明顯大於垂直（不然是在上下捲）
const SWIPE_MAX_MS = 600;    // 超過這個時間就是在拖、在選字，不是在翻頁
const SWIPE_EDGE = 24;       // 螢幕左右邊緣留給系統手勢（iPhone 從邊緣滑是返回）

export function routeTitle(book, route) {
  if (route === '' || route == null) return '封面';
  const r = parseRoute(toHash(route), book.chapters.length);
  return r.name === 'ch' ? chapterTitle(book.chapters[r.no - 1]) : FIXED_TITLES[r.name] || '封面';
}

// 送給 GA 的網址：把書頁的路由當成路徑（…/wenchang-yinzhi-wen/ch/3），不用 #。
// GA 報表的「網頁路徑」不看 # 後面，用 # 的話十一頁會全部算成同一頁。
// 這些路徑只出現在 GA 報表裡，伺服器上並沒有這些網址。
export function pageViewUrl(loc, route) {
  const dir = loc.pathname.replace(/[^/]*$/, ''); // /book/index.html → /book/
  return `${loc.origin}${dir}${route}`;
}

// 是不是被嵌在別人的網頁裡（部落格文章的 iframe）。跨網域時讀 top 會丟例外，那也算是
function detectEmbedded(win) {
  try { return win.self !== win.top; } catch { return true; }
}

// zhuyin 是注音資料（js/data/zhuyin.json），沒有就沒有「注音」開關；prefs 沒給就用不保存的
export function createApp({
  root, book, store, daily, speech, zhuyin = null, prefs = createPrefs(null),
  win = globalThis.window, embedded = detectEmbedded(win),
}) {
  const doc = root.ownerDocument;
  const order = pages(book.chapters);
  let current = null;
  let rendered = false;
  let tracked = null; // 上一次送給 GA 的路由（同一頁重畫不重送）

  // 頂列：目錄｜書名（回封面）｜種子數（到「我的福田」）。書名用短的（陰騭文），手機上才放得下
  const topbar = el('header', 'topbar');
  const lamps = button(null, 'tb-lamps', () => go('land'));
  const title = button(BOOK_SHORT_TITLE, 'tb-title', () => go(''));
  title.setAttribute('aria-label', `${BOOK_TITLE}：回封面`);
  append(
    topbar,
    button('目錄', 'tb-btn', () => go('toc')),
    title,
    lamps,
  );
  const view = el('div', 'view');
  root.textContent = '';
  append(root, topbar, view);

  function refreshTopbar() {
    const n = store.totalLit();
    lamps.textContent = `種子 ${n}／${TOTAL_LAMPS}`;
    lamps.setAttribute('aria-label', `已種下 ${n} 顆種子，共 ${TOTAL_LAMPS} 顆。前往「我的福田」`);
  }

  const ctx = {
    book, store, daily, speech, zhuyin, prefs, go, refreshTopbar, embedded,
    routeTitle: (route) => routeTitle(book, route),
    isPage: (route) => order.includes(route),
    next: (route) => nextRoute(book.chapters, route),
    prev: (route) => prevRoute(book.chapters, route),
  };

  function render() {
    speech.stop(); // 翻頁就停止朗讀
    const r = parseRoute(win.location.hash, book.chapters.length);
    current = r.route;
    view.textContent = '';
    topbar.hidden = r.name === 'cover';

    // 記下讀到哪：只記「書頁」（各頁、古今對照、我的福田），目錄和時時方便不算
    if (order.includes(r.route)) store.setLast(r.route);
    if (r.name === 'ch') store.markSeen(book.chapters[r.no - 1].id);

    if (r.name === 'ch') renderChapter(view, ctx, r.no);
    else if (r.name === 'toc') renderToc(view, ctx);
    else if (r.name === 'match') renderMatch(view, ctx);
    else if (r.name === 'land') renderLand(view, ctx);
    else if (r.name === 'daily') renderDaily(view, ctx);
    else if (r.name === 'about') renderAbout(view, ctx);
    else renderCover(view, ctx);

    refreshTopbar();
    preloadNext(r.route);
    doc.title = r.name === 'cover' ? `${BOOK_TITLE}｜互動電子書` : `${routeTitle(book, r.route)}｜${BOOK_TITLE}`;
    try { win.scrollTo(0, 0); } catch { /* 測試環境沒有捲動 */ }

    // 換頁後把焦點放到新頁的標題：螢幕閱讀器會唸出新的一頁，鍵盤也從頁首繼續。
    // 第一次載入不動焦點（嵌在別的網頁裡時，不該一載入就把焦點搶過來）
    if (rendered) {
      const h1 = view.querySelector('h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1'); // 可以被程式聚焦，但不會出現在 Tab 順序裡
        h1.focus({ preventScroll: true });
      }
    }
    trackPageView(r.route, !rendered);
    rendered = true;
  }

  // 每翻到新的一頁送一筆 page_view 給 GA，標題就是章名，報表裡看得出各章有多少人讀。
  // 第一次載入不送：Google 代碼自己會送第一筆，再送就重複了。
  // 沒有 Google 代碼（被擋廣告的外掛擋掉、離線）就什麼都不做；GA 出錯也不能影響翻頁。
  function trackPageView(route, first) {
    if (route === tracked) return;
    tracked = route;
    if (first || typeof win.gtag !== 'function') return;
    try {
      win.gtag('event', 'page_view', { page_title: doc.title, page_location: pageViewUrl(win.location, route) });
    } catch { /* 不影響閱讀 */ }
  }

  function preloadNext(route) {
    const next = parseRoute(toHash(ctx.next(route) ?? ''), book.chapters.length);
    const file = next.name === 'ch' ? book.chapters[next.no - 1].art : next.name === 'land' ? LAND_ART : null;
    if (file && typeof win.Image === 'function') new win.Image().src = `assets/art/${file}`;
  }

  function go(route) {
    if (route == null) return;
    // 大圖開著時不換頁：它在瀏覽歷程上持有一筆紀錄，這時換頁會讓「上一頁」錯位
    if (hasOpenLayer()) return;
    const hash = toHash(route);
    if (win.location.hash !== hash) {
      // 嵌在別的網頁裡：用 replace，不然每翻一頁，外面那個網頁就多一筆「上一頁」，
      // 讀完十一頁要按十一次返回才離得開那篇文章
      if (embedded) win.location.replace(hash);
      else win.location.hash = hash;
    }
    render();
  }

  // 瀏覽器的上一頁／下一頁、手動改網址。go() 自己已經畫過的不重畫
  const onHashChange = () => {
    if (parseRoute(win.location.hash, book.chapters.length).route !== current) render();
  };
  win.addEventListener('hashchange', onHashChange);

  // 鍵盤左右鍵翻頁
  const onKeydown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.shiftKey) return;     // Shift＋方向鍵是在延伸選取
    if (e.repeat) return;       // 按住不放的連發：不要一路翻到最後一頁
    if (hasOpenLayer()) return; // 大圖開著：方向鍵不翻頁，Esc 交給 layer.js
    if (e.target?.closest?.('input, textarea, select')) return;
    const to = e.key === 'ArrowRight' ? ctx.next(current) : e.key === 'ArrowLeft' ? ctx.prev(current) : undefined;
    if (to != null) go(to);
  };
  doc.addEventListener('keydown', onKeydown);

  // 手機左右滑翻頁。只認「單指、快速、明顯水平」的一滑；下面每一條排除的都是實際會誤翻的情況
  let start = null;
  view.addEventListener('touchstart', (e) => {
    start = null;
    if (e.touches?.length !== 1) return;                          // 第二根手指放下來（捏合縮放、兩指點）
    if ((win.visualViewport?.scale ?? 1) > 1.05) return;          // 畫面被放大：左右滑是在平移
    const t = e.touches[0];
    if (t.clientX < SWIPE_EDGE || t.clientX > win.innerWidth - SWIPE_EDGE) return; // 邊緣是系統的返回手勢
    if (e.target?.closest?.('.match-board, input')) return;       // 配對盤面上拖來拖去、勾選框
    start = { id: t.identifier, x: t.clientX, y: t.clientY, at: Date.now() };
  }, { passive: true });
  view.addEventListener('touchcancel', () => { start = null; }, { passive: true });
  view.addEventListener('touchend', (e) => {
    const from = start;
    start = null;
    if (!from || e.touches?.length) return;                       // 還有手指在螢幕上
    const t = [...(e.changedTouches || [])].find((c) => c.identifier === from.id);
    if (!t) return;                                               // 放開的不是當初那根手指
    if (Date.now() - from.at > SWIPE_MAX_MS) return;              // 慢慢拖（長按、選字）
    if (String(win.getSelection?.() ?? '') !== '') return;        // 正在選字
    const dx = t.clientX - from.x;
    const dy = t.clientY - from.y;
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
    const to = dx < 0 ? ctx.next(current) : ctx.prev(current);
    if (to != null) go(to);
  }, { passive: true });

  // 同一本書開在另一個分頁、那邊改了進度：把手上的資料更新成最新的。
  // 不重畫整頁（會把正在讀的人捲回最上面），只更新頂列的種子數
  const onStorage = (e) => {
    if (e.key != null && e.key !== SAVE_KEY && e.key !== DAILY_KEY && e.key !== PREFS_KEY) return; // key 為 null 是整個被清空
    store.refresh();
    daily.refresh();
    prefs.refresh(); // 注音的開關：下次畫章節頁時照新的
    refreshTopbar();
  };
  win.addEventListener('storage', onStorage);

  // 分頁切回來：資料更新成最新的；時時方便可能已經跨日，整頁重畫成今天
  const onVisible = () => {
    if (doc.visibilityState === 'hidden') return;
    store.refresh();
    daily.refresh();
    prefs.refresh();
    refreshTopbar();
    if (current === 'daily' && !hasOpenLayer()) render();
  };
  doc.addEventListener('visibilitychange', onVisible);

  // 掛在 window／document 上的監聽要能拿掉：同一頁若重建 app（測試、日後的熱重載），
  // 舊的那個不該繼續跟著翻頁
  function destroy() {
    win.removeEventListener('hashchange', onHashChange);
    win.removeEventListener('storage', onStorage);
    doc.removeEventListener('keydown', onKeydown);
    doc.removeEventListener('visibilitychange', onVisible);
  }

  return { render, go, destroy };
}
