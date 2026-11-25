import { el, button, append } from './dom.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
// 'YYYY-MM-DD' → 本地日期（不要用 new Date(key)，那會被當成 UTC）
const toDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

// 時時方便：利人、利物、陰功，每天三件小事的自我檢核。文字在 js/data/daily.json。
export function renderDaily(root, ctx) {
  const { book, daily, go } = ctx;
  const data = book.daily;
  const items = data.items.length;
  const page = el('section', 'page daily');
  append(page, el('p', 'ch-kicker', '把這一篇帶回生活'), el('h1', null, '時時方便'));

  // 這個畫面是為「哪一天」畫的。分頁放著過夜之後，這一天就不是今天了
  const shownKey = daily.todayKey();
  const t = toDate(shownKey);
  page.appendChild(el('p', 'daily-date', `${t.getFullYear()} 年 ${t.getMonth() + 1} 月 ${t.getDate()} 日（${WEEK[t.getDay()]}）`));
  append(page, el('blockquote', 'daily-quote', data.quote), el('p', 'lead', data.intro));

  const count = el('p', 'daily-count');
  const closing = el('p', 'daily-closing');
  const week = el('div', 'daily-week');
  const streak = el('p', 'daily-streak');
  const total = el('p', 'daily-total');
  const boxes = [];

  function refresh() {
    const today = daily.today();
    boxes.forEach((box, i) => { box.checked = today[i]; }); // 以存檔為準（另一個分頁可能也勾了）
    const n = daily.countToday();
    count.textContent = `今天 ${n}／${items}`;
    closing.textContent = n === 0 ? data.closing.none : n === items ? data.closing.all : data.closing.some;
    week.textContent = '';
    for (const day of daily.history(7)) {
      const d = toDate(day.key);
      const cell = el('div', `daily-day${day.count ? ' has' : ''}${day.key === shownKey ? ' today' : ''}`);
      cell.setAttribute('aria-label', `${d.getMonth() + 1} 月 ${d.getDate()} 日：${day.count == null ? '沒有紀錄' : `${day.count} 件`}`);
      append(cell, el('span', 'daily-dow', WEEK[d.getDay()]), el('span', 'daily-dot', day.count ? String(day.count) : '·'));
      week.appendChild(cell);
    }
    const s = daily.streak();
    streak.textContent = s > 1 ? `已經連續 ${s} 天` : '';
    total.textContent = `累積 ${daily.total()} 件`;
  }

  const list = el('ol', 'daily-list');
  data.items.forEach((item, i) => {
    const label = el('label', 'daily-item');
    const box = el('input');
    box.type = 'checkbox';
    boxes.push(box);
    box.addEventListener('change', () => {
      if (daily.todayKey() !== shownKey) {
        // 已經過了午夜：畫面上還是昨天的勾。只有「打勾」才算數（記在新的一天）；
        // 「取消」是想取消昨天的，新的一天本來就沒勾，不必寫。然後整頁換成今天。
        if (box.checked) daily.set(i, true);
        go('daily');
        return;
      }
      daily.set(i, box.checked); // 直接寫成畫面上的狀態，不用「反轉」——存檔和畫面不同步時才不會勾反
      refresh();
    });
    append(label, box, append(el('span', 'daily-text'), el('span', 'daily-name', item.name), el('span', 'daily-ask', item.ask)));
    list.appendChild(append(el('li'), label));
  });

  append(page, list, count, closing, el('h2', null, '最近七天'), week, streak);

  // 累積：從開始記錄到現在一共做了幾件。只是提醒，不是成績
  const sum = el('div', 'daily-sum');
  append(sum, total, el('p', 'daily-sum-note', data.totalNote));
  page.appendChild(sum);
  page.appendChild(el('p', 'hint', '紀錄只存在這台裝置的瀏覽器裡，不會上傳。'));

  const actions = el('div', 'land-actions');
  append(actions, button('目錄', 'btn', () => go('toc')), button('我的福田', 'btn', () => go('land')));
  page.appendChild(actions);

  refresh();
  root.appendChild(page);
}
