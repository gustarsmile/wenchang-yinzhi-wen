import { el, button, append, cnNumber } from './dom.js';
import { lampList, plotCount, chapterTitle } from '../book.js';
import { MATCH_AFTER } from '../config.js';
import { OVERVIEW_GROUPS } from './chapterView.js';

// 目錄分段：哪一頁開始要放小標（和第一頁「全篇十一段」的分組一致）
const SECTION_AT = Object.fromEntries(OVERVIEW_GROUPS.map(([title, parts]) => [parts[0], title]));

export function renderToc(root, ctx) {
  const { book, store, go } = ctx;
  const page = el('section', 'page toc');
  page.appendChild(el('h1', null, '目錄'));

  const list = el('div', 'toc-list');
  for (const ch of book.chapters) {
    if (SECTION_AT[ch.part]) list.appendChild(el('h2', 'toc-section', SECTION_AT[ch.part]));
    const row = button(null, 'toc-row toc-chapter', () => go(`ch/${ch.no}`));
    const lamps = lampList(ch);
    append(
      row,
      el('span', 'toc-no', cnNumber(ch.part)),
      append(el('span', 'toc-text'), el('span', 'toc-title', chapterTitle(ch)), el('span', 'toc-sub', ch.subtitle)),
    );
    if (lamps) {
      const done = store.isChapterComplete(ch);
      row.appendChild(el('span', `toc-mark${done ? ' done' : ''}`, `${store.litCount(ch.id)}／${lamps.items.length}`));
    } else if (store.isSeen(ch.id)) {
      row.appendChild(el('span', 'toc-mark done', '已讀'));
    }
    list.appendChild(row);
    if (ch.no === MATCH_AFTER) {
      const m = button(null, 'toc-row toc-extra', () => go('match'));
      append(m, el('span', 'toc-no', '◇'), append(el('span', 'toc-text'), el('span', 'toc-title', '古今對照'), el('span', 'toc-sub', '夜燈、茶水、渡船，換成今天是什麼')));
      if (store.isMatchDone()) m.appendChild(el('span', 'toc-mark done', '完成'));
      list.appendChild(m);
    }
  }

  list.appendChild(el('h2', 'toc-section', '其他'));
  const extras = [
    ['land', '我的福田', `已開 ${store.plotsDone(book.chapters)}／${plotCount(book.chapters)} 塊田`],
    ['daily', '時時方便', '利人、利物、陰功，每天一分鐘'],
    ['about', '關於本書', '底本、註解依據與流通'],
  ];
  for (const [route, title, sub] of extras) {
    const row = button(null, 'toc-row toc-extra', () => go(route));
    append(row, el('span', 'toc-no', '◇'), append(el('span', 'toc-text'), el('span', 'toc-title', title), el('span', 'toc-sub', sub)));
    list.appendChild(row);
  }

  page.appendChild(list);
  root.appendChild(page);
}
