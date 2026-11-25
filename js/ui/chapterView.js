import { el, button, append, artFigure, cnNumber } from './dom.js';
import { rawWithTerms } from './gloss.js';
import { lampList, partChapters, chapterTitle, chapterRaw, splitSentences } from '../book.js';
import { PARTS } from '../config.js';
import { annotateForDisplay } from '../zhuyin.js';

// 「全篇十一段」一覽：怎麼分組、每一段一句話（tocView.js 的小標和這裡的分組一致）
export const OVERVIEW_GROUPS = [
  ['帝君怎麼做', [1, 2]],
  ['從心地開始', [3, 4]],
  ['伸手幫人', [5, 6]],
  ['愛惜萬物，不傷害人', [7, 8]],
  ['把自己做好', [9, 10]],
  ['福從哪裡來', [11]],
];
const PART_GIST = [
  '十七世的存心',
  '于公、竇氏、救蟻、埋蛇',
  '福田要靠心地來種',
  '家人、師長與信仰',
  '十二件幫人的事',
  '秤要準，路要亮',
  '放生、護生、惜字紙',
  '十件不可以做的事',
  '守本分，管好一張嘴',
  '替後面的人著想',
  '諸惡莫作，眾善奉行',
];

// 種子清單上方的提示，依清單的性質（tone）而不同
const LIST_HINT = {
  good: '點一下，看白話，種下一顆種子。',
  guard: '點一下，看白話，種下一顆種子：看清一件不該做的事、守住它，心地就乾淨一分。',
  story: '點一下，看白話和完整的故事，種下一顆種子。',
};

// 整列都可以點，但這兩種情況不算「點這一列」：
// 點在已經展開的白話或註解上（人家在讀）、或是正在拖曳選取文字（想複製原文）
function isReading(e) {
  if (e.target?.closest?.('.plain, .gloss-note')) return true;
  return String(globalThis.getSelection?.() ?? '') !== '';
}

// 一段原文＋註解框＋白話。raws 收集這一頁每一筆原文（開關注音時要一筆一筆重畫）
function passageBlock(block, glossary, plainNodes, raws) {
  const box = el('div', 'passage');
  const { node, note, setReadings } = rawWithTerms(block.raw, block.terms, glossary);
  raws.push({ raw: block.raw, setReadings });
  const plain = el('p', 'plain', block.plain);
  plainNodes.push(plain);
  append(box, append(el('p', 'raw-line'), node), note, plain);
  return box;
}

// 典故背後的完整故事（第 2 頁）：標題、人物、插圖、故事、出處。跟著白話一起，點了才出現
function storyBox(story) {
  const box = el('div', 'story');
  append(
    box,
    el('h4', 'story-title', story.title),
    el('p', 'story-who', story.who),
    story.art ? artFigure(story.art, story.alt, 'art-frame story-art') : null,
    el('p', 'story-text', story.text),
    el('p', 'story-source', `出處：${story.source}`),
  );
  return box;
}

// 種子清單（四個典故、各頁的善行）：一列一顆種子，點了才發芽、才顯示白話。
// 程式裡的名字沿用《太上感應篇》那本的「燈」（lamps、lit）
function lampsBlock(block, ch, ctx, raws) {
  const { store, book, go } = ctx;
  const total = block.items.length;
  const box = el('div', `lamps tone-${block.tone}`);

  const count = el('span', 'lamp-count');
  const head = el('div', 'list-head');
  append(head, el('span', 'list-name', block.name), el('span', 'list-note', block.nameNote), count);
  box.appendChild(head);
  box.appendChild(el('p', 'hint', LIST_HINT[block.tone] || LIST_HINT.good));

  const done = el('p', 'lamps-done');
  const doneText = el('span');
  append(done, doneText, button('去看看', 'link', () => go('land')));

  const refresh = () => {
    count.textContent = `已種下 ${store.litCount(ch.id)}／${total}`;
    const pageDone = store.isChapterComplete(ch);
    done.hidden = !pageDone;
    if (pageDone) doneText.textContent = `〈${ch.title}〉的種子全部種下了，「我的福田」開了一塊花田。`;
  };

  // 清單長的時候分成幾組，各有小標；每一組是一個 <ol>
  let group = null;
  let list = null;
  block.items.forEach((item, i) => {
    if (!list || (item.group && item.group !== group)) {
      if (item.group) {
        group = item.group;
        box.appendChild(el('h3', 'lamp-group', group));
      }
      list = el('ol', 'lamp-list');
      box.appendChild(list);
    }
    const row = el('li', 'lamp-row');
    const lamp = el('button', 'lamp');
    lamp.type = 'button';
    lamp.setAttribute('aria-label', `第 ${i + 1} 顆種子`);
    const { node, note, setReadings } = rawWithTerms(item.raw, item.terms, book.glossary);
    raws.push({ raw: item.raw, setReadings });
    const plain = el('div', 'plain');
    plain.appendChild(el('p', null, item.plain));
    if (item.story) plain.appendChild(storyBox(item.story));
    if (item.note) plain.appendChild(el('p', 'collation', item.note));

    const show = (lit) => {
      lamp.classList.toggle('lit', lit);
      lamp.setAttribute('aria-pressed', String(lit));
      row.classList.toggle('lit', lit);
      plain.hidden = !lit;
    };
    show(store.isLit(ch.id, i));

    const light = () => {
      const fresh = store.lightLamp(ch.id, i);
      // 不管是不是「新」種下的都讓畫面發芽：這一顆可能已經在另一個分頁點過了
      show(true);
      if (fresh) lamp.classList.add('pop');
      refresh();
      ctx.refreshTopbar();
    };
    // 直接按種子是明確的操作；點整列（手機上種子比較小）則要排除正在讀字、選字的情況。
    // 點難詞時 gloss 會擋下來，不會誤種
    lamp.addEventListener('click', (e) => { e.stopPropagation(); light(); });
    row.addEventListener('click', (e) => { if (!isReading(e)) light(); });

    append(row, lamp, append(el('div', 'lamp-body'), append(el('p', 'raw-line'), node), note, plain));
    list.appendChild(row);
  });

  refresh();
  box.appendChild(done);
  return box;
}

function scenarioSection(ch, ctx) {
  const { store } = ctx;
  const sec = el('section', 'scenario');
  append(sec, el('h2', null, '生活裡的這一段'), el('p', 'prompt', ch.scenario.prompt));
  const reply = el('p', 'reply');
  reply.hidden = true;
  reply.setAttribute('aria-live', 'polite');

  const options = el('div', 'options');
  const buttons = ch.scenario.options.map((opt, i) => button(opt.text, 'option', () => {
    store.setScenario(ch.id, i);
    choose(i);
  }));
  function choose(i) {
    buttons.forEach((b, k) => {
      b.classList.toggle('chosen', k === i);
      b.setAttribute('aria-pressed', String(k === i));
    });
    reply.textContent = ch.scenario.options[i].reply;
    reply.hidden = false;
  }
  buttons.forEach((b) => { b.setAttribute('aria-pressed', 'false'); options.appendChild(b); });
  append(sec, options, reply, el('p', 'hint', '沒有標準答案，也不計分。選一個最接近你的，看看這一段怎麼說。'));

  const saved = store.getScenario(ch.id);
  if (saved !== null && saved < buttons.length) choose(saved);
  return sec;
}

// 一段的進度：有種子的段顯示「種下幾顆／共幾顆」，沒有種子的段顯示讀過了沒
function partProgress(ctx, part) {
  const { book, store } = ctx;
  const list = partChapters(book.chapters, part);
  const total = list.reduce((n, c) => n + (lampList(c)?.items.length ?? 0), 0);
  const done = store.isPartComplete(book.chapters, part);
  if (total > 0) return { text: `${list.reduce((n, c) => n + store.litCount(c.id), 0)}／${total}`, done };
  return { text: done ? '已讀' : '未讀', done };
}

// 第一頁：全篇十一段一覽，點了跳到那一段
function overviewSection(ctx) {
  const { book, go } = ctx;
  const sec = el('section', 'overview');
  sec.appendChild(el('h2', null, '全篇十一段'));
  for (const [title, parts] of OVERVIEW_GROUPS) {
    sec.appendChild(el('h3', 'overview-group', title));
    const wrap = el('div', 'overview-chips');
    for (const part of parts) {
      const first = partChapters(book.chapters, part)[0];
      const chip = button(null, 'overview-chip', () => go(`ch/${first.no}`));
      const progress = partProgress(ctx, part);
      append(
        chip,
        el('span', 'chip-name', PARTS[part - 1]),
        el('span', 'chip-sub', PART_GIST[part - 1]),
        el('span', `chip-progress${progress.done ? ' done' : ''}`, progress.text),
      );
      wrap.appendChild(chip);
    }
    sec.appendChild(wrap);
  }
  return sec;
}

function speakButton(ch, ctx) {
  const { speech } = ctx;
  if (!speech.supported) return null;
  const b = button('朗讀', 'btn small btn-speak');
  b.setAttribute('aria-pressed', 'false');
  const idle = () => { b.textContent = '朗讀'; b.setAttribute('aria-pressed', 'false'); };
  b.addEventListener('click', () => {
    if (speech.isSpeaking()) { speech.stop(); return; } // stop 會觸發 onEnd → idle
    // Chrome 的語音清單載入後才知道有沒有中文語音；確定沒有就直說，不要讓人按了沒反應
    if (speech.voicesLoaded() && !speech.hasVoice()) {
      b.textContent = '這個裝置沒有中文語音';
      b.disabled = true;
      return;
    }
    b.textContent = '停止朗讀';
    b.setAttribute('aria-pressed', 'true');
    speech.speak(splitSentences(chapterRaw(ch)), { onEnd: idle });
  });
  return b;
}

// 「注音：開／關」：只有原文加注音，白話、註解都不加。狀態記在偏好裡，換頁、重開都記得。
// 沒有注音資料（zhuyin.json 讀不到）就沒有這顆按鈕
function zhuyinToggle(ctx, section, raws) {
  const { zhuyin, prefs } = ctx;
  if (!zhuyin) return null;
  let shown = false;
  const b = button(null, 'btn small', () => {
    prefs.setZhuyin(!shown);
    show(prefs.getZhuyin());
  }, 'toggle-zhuyin');
  function show(on) {
    b.textContent = on ? '注音：開' : '注音：關';
    b.setAttribute('aria-pressed', String(on));
    section.classList.toggle('zhuyin-on', on); // 開注音時字放大、行距拉開（css/style.css）
    if (on !== shown) for (const r of raws) r.setReadings(on ? annotateForDisplay(r.raw, zhuyin) : null);
    shown = on;
  }
  // 開著注音時複製原文：注音欄是絕對定位的區塊，瀏覽器把選取的字轉成文字時，會在每個字後面多塞一個換行。
  // 複製的那一刻先把注音藏起來（.zhuyin-copy）再取文字，貼出去的就和沒開注音時一樣。同步做完，畫面不會閃
  section.addEventListener('copy', (e) => {
    if (!shown || !e.clipboardData) return;
    section.classList.add('zhuyin-copy');
    const text = String(globalThis.getSelection?.() ?? '');
    section.classList.remove('zhuyin-copy');
    if (!text) return;
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  });
  show(prefs.getZhuyin());
  return b;
}

// 段次：「第四段」。《陰騭文》沒有傳統的分章，十一段是本書依內容分的
function kickerOf(ch) {
  return `第${cnNumber(ch.part)}段`;
}

export function renderChapter(root, ctx, no) {
  const { book, go } = ctx;
  const ch = book.chapters[no - 1];
  const route = `ch/${no}`;
  const page = el('article', `page chapter kind-${ch.kind}`);

  // 左欄（寬螢幕）：章名、插圖、導讀
  const side = el('div', 'ch-side');
  const header = el('header', 'ch-head');
  append(header, el('p', 'ch-kicker', kickerOf(ch)), el('h1', null, chapterTitle(ch)), el('p', 'ch-sub', ch.subtitle));
  append(side, header, artFigure(ch.art, ch.alt), el('p', 'lead', ch.lead));

  // 右欄：原文與互動
  const main = el('div', 'ch-main');
  const text = el('section', 'sutra');
  const plainNodes = [];
  const raws = [];
  const blocks = ch.blocks.map((block) => (block.type === 'passage'
    ? passageBlock(block, book.glossary, plainNodes, raws)
    : lampsBlock(block, ch, ctx, raws)));

  const tools = el('div', 'sec-tools');
  let toggle = null;
  // 這一頁有「段落」才需要白話開關（只有種子清單的頁，白話是點了才出現）
  if (plainNodes.length) {
    toggle = button('白話：開', 'btn small', () => {
      const hide = !plainNodes[0].hidden;
      plainNodes.forEach((p) => { p.hidden = hide; });
      toggle.textContent = hide ? '白話：關' : '白話：開';
      toggle.setAttribute('aria-pressed', String(!hide));
    }, 'toggle-plain');
    toggle.setAttribute('aria-pressed', 'true');
  }
  append(tools, speakButton(ch, ctx), zhuyinToggle(ctx, text, raws), toggle);
  append(text, append(el('div', 'sec-head'), el('h2', null, '經文'), tools), ...blocks);
  main.appendChild(text);

  if (ch.kind === 'intro') main.appendChild(overviewSection(ctx));
  if (ch.scenario) main.appendChild(scenarioSection(ch, ctx));
  if (ch.kind === 'end') {
    const cta = el('section', 'cta');
    append(
      cta,
      el('p', null, '全篇到這裡結束。你讀過的每一段、種下的每一顆種子，都讓福田多開一塊。'),
      button('去看「我的福田」', 'btn primary', () => go('land')),
    );
    main.appendChild(cta);
  }
  if (ch.takeaway) main.appendChild(el('blockquote', 'takeaway', ch.takeaway));

  // 翻頁
  const nav = el('nav', 'pager');
  nav.setAttribute('aria-label', '翻頁');
  const prev = ctx.prev(route);
  const next = ctx.next(route);
  append(
    nav,
    button(`‹ ${prev === '' ? '封面' : ctx.routeTitle(prev)}`, 'btn pager-prev', () => go(prev), 'prev'),
    next ? button(`${ctx.routeTitle(next)} ›`, 'btn primary pager-next', () => go(next), 'next') : null,
  );
  main.appendChild(nav);

  append(page, side, main);
  root.appendChild(page);
}
