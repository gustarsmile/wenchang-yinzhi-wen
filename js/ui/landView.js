import { el, button, append, artFigure } from './dom.js';
import { PARTS, TOTAL_LAMPS, LAND_ART, LAND_ALT, MATCH_AFTER } from '../config.js';

// 我的福田：一幅畫被十二塊還沒開墾的田蓋住（3 列 × 4 欄），讀完一段就開一塊。
// 十二塊＝十一段各一塊，加上「古今對照」；順序就是翻頁的順序。
// 有種子的段要把種子全部種下；沒有種子的段，讀過就算；「古今對照」要配對完成。
export function landPlots(ctx) {
  const { book, store } = ctx;
  const done = store.completedParts(book.chapters);
  const plots = [];
  for (const ch of book.chapters) {
    plots.push({ name: PARTS[ch.part - 1], clear: done.includes(ch.part), route: `ch/${ch.no}` });
    if (ch.no === MATCH_AFTER) plots.push({ name: '古今對照', clear: store.isMatchDone(), route: 'match' });
  }
  return plots;
}

export function renderLand(root, ctx) {
  const { book, store, go } = ctx;
  const plots = landPlots(ctx);
  const opened = plots.filter((p) => p.clear).length;

  const page = el('section', 'page land');
  append(page, el('p', 'ch-kicker', '你的進度'), el('h1', null, '我的福田'));

  const allClear = opened === plots.length;
  let frame;
  if (allClear) {
    // 十二塊都開了：整幅畫可以點開放大
    frame = artFigure(LAND_ART, LAND_ALT, 'land-frame');
  } else {
    // 還有沒開的田：圖上蓋一層 3×4 的格子，開了的那一塊透明、其餘是泥土。這時不能放大（放大就看光了）
    frame = artFigure(LAND_ART, '被十二塊田蓋住的一幅畫，讀完一段就開一塊', 'land-frame', { zoom: false });
    const grid = el('div', 'land-grid');
    for (const plot of plots) {
      // 點還沒開的田：前往那一頁
      const tile = button(plot.clear ? null : plot.name, `land-tile ${plot.clear ? 'clear' : 'soil'}`, () => go(plot.route));
      tile.setAttribute('aria-label', plot.clear ? `${plot.name}：已經開花` : `${plot.name}：還沒開，前往這一頁`);
      if (plot.clear) tile.disabled = true;
      grid.appendChild(tile);
    }
    frame.appendChild(grid);
  }
  page.appendChild(frame);

  page.appendChild(el('p', 'land-count', `已開 ${opened}／${plots.length} 塊田　種子 ${store.totalLit()}／${TOTAL_LAMPS}`));

  const complete = el('div', 'land-complete');
  complete.hidden = !allClear;
  const root3 = book.chapters.find((c) => c.part === 3).blocks[0]; // 〈心地福田〉：欲廣福田，須憑心地
  append(
    complete,
    el('p', 'raw-line', root3.raw),
    el('p', 'plain', root3.plain),
    el('p', 'land-thanks', '十二塊田都開了。經文最後問：「百福駢臻，千祥雲集，豈不從陰騭中得來者哉？」這片田不是讀完就有的，是每天一件一件順手的好事，慢慢種出來的。'),
  );
  page.appendChild(complete);
  if (complete.hidden) page.appendChild(el('p', 'hint', '把一段的種子全部種下，那一塊田就會開花；沒有種子的段，讀過就算；「古今對照」配對完成也開一塊。點還沒開的田，可以前往那一頁。'));

  const actions = el('div', 'land-actions');
  append(actions, button('每日種福', 'btn primary', () => go('daily')), button('目錄', 'btn', () => go('toc')));
  page.appendChild(actions);

  const nav = el('nav', 'pager');
  nav.setAttribute('aria-label', '翻頁');
  nav.appendChild(button(`‹ ${ctx.routeTitle(ctx.prev('land'))}`, 'btn pager-prev', () => go(ctx.prev('land')), 'prev'));
  page.appendChild(nav);

  root.appendChild(page);
}
