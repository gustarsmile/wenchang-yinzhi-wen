// 原文裡的難詞：畫成可以點的字，點了在該段下方顯示註解。
// 只在原文上「加標記」，不增刪任何字——沒開注音時 node.textContent 永遠等於 raw；
// 開了注音，每個漢字包成 <ruby>字<rt>注音</rt></ruby>，把 <rt> 拿掉之後還是等於 raw。
import { el } from './dom.js';
import { splitSyllable } from '../zhuyin.js';

// 一個字＋它右邊的直式注音（課本那種排法，樣式在 css/style.css 的「注音」）：
//   <ruby>字<rt><span class="zy-col"><span>ㄋ</span><span>ㄧ</span></span><span class="zy-tone">ˇ</span></rt></ruby>
// 符號一個一格由上往下疊；輕聲的點是這一欄最上面的一格；二三四聲的調號另外一格，排在欄的右邊。
// 不用 ruby-position: inter-character（Chrome 不支援），整組是自己排的（rt 絕對定位在字右邊空出來的那一欄）；
// <rt> 的文字接起來還是資料裡的寫法（˙ㄉㄜ、ㄋㄧˇ），語意上仍是 ruby
function zhuyinUnit(ch, reading) {
  const { dot, symbols, tone } = splitSyllable(reading);
  const col = el('span', 'zy-col');
  if (dot) col.appendChild(el('span', 'zy-dot', '˙'));
  for (const s of symbols) col.appendChild(el('span', null, s));
  const rt = el('rt');
  rt.appendChild(col);
  if (tone) rt.appendChild(el('span', 'zy-tone', tone));
  const ruby = el('ruby', null, ch);
  ruby.appendChild(rt);
  return ruby;
}

// 找出每個詞條在 raw 裡第一個「不和別的詞條重疊」的位置
function locate(raw, termKeys, glossary) {
  const ranges = [];
  for (const key of termKeys) {
    const entry = glossary[key];
    if (!entry) continue;
    let from = 0;
    for (;;) {
      const start = raw.indexOf(entry.term, from);
      if (start === -1) break;
      const end = start + entry.term.length;
      if (!ranges.some((r) => start < r.end && end > r.start)) { ranges.push({ start, end, entry }); break; }
      from = start + 1;
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

// 把一小段原文放進 host。readings 是這一小段每個字的讀音（標點是 null）；沒有 readings 就是純文字。
// 連續沒有讀音的字（標點）合成一個文字節點
function fill(host, text, readings) {
  if (!readings) { host.appendChild(document.createTextNode(text)); return; }
  let plain = '';
  const flush = () => { if (plain) host.appendChild(document.createTextNode(plain)); plain = ''; };
  [...text].forEach((ch, i) => {
    if (!readings[i]) { plain += ch; return; }
    flush();
    host.appendChild(zhuyinUnit(ch, readings[i]));
  });
  flush();
}

// 回傳 { node, note, setReadings }：
//   node 放原文，note 是這一段共用的註解框（一次只開一個詞），
//   setReadings(讀音陣列) 加上注音、setReadings(null) 拿掉。讀音陣列和 raw 一樣長，一個字一格（js/zhuyin.js 的 annotate）
export function rawWithTerms(raw, termKeys, glossary) {
  const node = el('span', 'raw');
  const note = el('div', 'gloss-note');
  note.hidden = true;
  note.setAttribute('role', 'note');
  let open = null;

  const close = () => {
    if (open) open.setAttribute('aria-expanded', 'false');
    open = null;
    note.hidden = true;
  };

  // 原文切成一片一片：難詞（term 是它的 <span>）和難詞之間的文字。
  // 開關注音時只重填每一片的字；難詞的 <span> 一直是同一個，掛在上面的事件和展開狀態都不受影響
  const pieces = [];
  let pos = 0;
  for (const r of locate(raw, termKeys || [], glossary)) {
    if (r.start > pos) pieces.push({ text: raw.slice(pos, r.start), term: null });
    // 用 <span role="button"> 而不是 <button>：按鈕是不能斷行的一整塊，
    // 像「阿耨多羅三藐三菩提」這種長詞會把手機上的一行撐壞；span 可以照常斷行、選取、複製。
    const term = el('span', 'term');
    term.setAttribute('role', 'button');
    term.setAttribute('tabindex', '0');
    term.setAttribute('aria-expanded', 'false');
    const toggle = (e) => {
      e.stopPropagation(); // 不要順便觸發整列的點擊（點亮那一盞燈）
      if (open === term) { close(); return; }
      close();
      note.textContent = '';
      note.appendChild(el('strong', null, r.entry.term));
      note.appendChild(document.createTextNode(`　${r.entry.note}`));
      note.hidden = false;
      term.setAttribute('aria-expanded', 'true');
      open = term;
    };
    term.addEventListener('click', toggle);
    // span 沒有按鈕內建的鍵盤行為，自己補 Enter 和空白鍵
    term.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); // 空白鍵預設會捲動頁面
      toggle(e);
    });
    pieces.push({ text: raw.slice(r.start, r.end), term });
    pos = r.end;
  }
  if (pos < raw.length) pieces.push({ text: raw.slice(pos), term: null });

  function setReadings(readings) {
    node.textContent = '';
    let at = 0; // 這一片的第一個字是 raw 的第幾個字
    for (const piece of pieces) {
      const size = [...piece.text].length;
      const host = piece.term || node;
      if (piece.term) { piece.term.textContent = ''; node.appendChild(piece.term); }
      fill(host, piece.text, readings ? readings.slice(at, at + size) : null);
      at += size;
    }
  }
  setReadings(null);

  return { node, note, setReadings };
}
