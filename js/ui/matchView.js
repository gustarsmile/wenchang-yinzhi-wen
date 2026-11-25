import { el, button, append } from './dom.js';

// 洗牌（Fisher–Yates）。rng 可注入，測試時不需要固定順序也能跑
function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 古今對照：左邊是原文裡的一句善行，右邊是今天做得到的一件事。
// 題目在 js/data/match.json：每一組的 raw 必須是原文裡的句子（tests/data.test.js 會檢查），
// plain 是它的白話，now 是本書寫的現代例子。
export function renderMatch(root, ctx) {
  const { book, store, go } = ctx;
  const { pairs } = book.match;
  const page = el('section', 'page match');
  append(
    page,
    el('p', 'ch-kicker', '小複習'),
    el('h1', null, '古今對照'),
    el('p', 'lead', book.match.lead),
  );
  if (store.isMatchDone()) page.appendChild(el('p', 'hint', '你已經完成過這個配對，想再玩一次也可以。'));

  const msg = el('p', 'match-msg');
  msg.setAttribute('aria-live', 'polite');
  const doneBox = el('div', 'match-done');
  doneBox.hidden = true;
  append(doneBox, el('p', null, book.match.done), button('去看「我的福田」', 'link', () => go('land')));

  let selected = null;
  let matched = 0;
  const leftCol = el('div', 'match-col match-left');
  const rightCol = el('div', 'match-col match-right');

  const select = (b) => {
    if (selected) selected.classList.remove('selected');
    selected = b;
    if (b) b.classList.add('selected');
  };

  for (const pair of pairs) {
    const b = button(null, 'match-item', () => { select(b); msg.textContent = `「${pair.raw}」換成今天，是哪一件事？`; });
    b.dataset.key = pair.id;
    append(b, el('span', 'match-name', pair.raw), el('span', 'match-sub', pair.plain));
    leftCol.appendChild(b);
  }

  for (const pair of shuffle(pairs)) {
    const b = button(null, 'match-item', () => {
      if (!selected) { msg.textContent = '先點左邊的一句原文，再點右邊。'; return; }
      if (selected.dataset.key !== b.dataset.key) {
        msg.textContent = '不是這一件，再想想。翻回前面看一眼也可以。';
        b.classList.remove('shake');
        void b.offsetWidth; // 讓動畫可以連續重播
        b.classList.add('shake');
        return;
      }
      for (const x of [selected, b]) { x.classList.add('matched'); x.classList.remove('selected'); x.disabled = true; }
      msg.textContent = `${pair.raw} ↔ ${pair.now}`;
      selected = null;
      matched += 1;
      if (matched === pairs.length) {
        store.setMatchDone();
        doneBox.hidden = false;
        msg.textContent = '';
      }
    });
    b.dataset.key = pair.id;
    append(b, el('span', 'match-sub match-now', pair.now));
    rightCol.appendChild(b);
  }

  const board = el('div', 'match-board');
  append(board, leftCol, rightCol);
  append(page, msg, board, doneBox);

  const nav = el('nav', 'pager');
  nav.setAttribute('aria-label', '翻頁');
  append(
    nav,
    button(`‹ ${ctx.routeTitle(ctx.prev('match'))}`, 'btn pager-prev', () => go(ctx.prev('match')), 'prev'),
    button(`${ctx.routeTitle(ctx.next('match'))} ›`, 'btn primary pager-next', () => go(ctx.next('match')), 'next'),
  );
  page.appendChild(nav);
  root.appendChild(page);
}
