// 注音：依 js/data/zhuyin.json 把一段原文的每個漢字標上讀音。這裡的函式都不碰 DOM。
//   chars    只有一個讀音的字
//   poly     破音字（辭典列出兩個以上讀音的字）在這篇文字裡的預設讀音
//   phrases  破音字在特定詞句裡不讀預設讀音的地方（鍵是原文裡連續的幾個字，讀音用空白分開、一字一音）
// 標的時候詞句優先於單字，長的詞句優先於短的。chars 和 poly 分開放，只是為了讓人一眼看出哪些是人工判斷。
const PATH = 'js/data/zhuyin.json';

async function defaultFetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}（${res.status}）`);
  return res.json();
}

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// 注音是選配的資料：讀不到就回 null，書照樣能讀，只是沒有「注音」開關
export async function loadZhuyin(fetchJson = defaultFetchJson) {
  try {
    const data = await fetchJson(PATH);
    return isObject(data) && isObject(data.chars) ? data : null;
  } catch {
    return null;
  }
}

// 全文的字都在這一區（tests/fidelity.test.js 會守）
export const isHan = (ch) => /^[㐀-鿿]$/.test(ch);

// 合法的注音音節：一聲不標調，二三四聲的調號寫在最後，輕聲的「˙」寫在最前面
const BODY = '(?:[ㄓㄔㄕㄖㄗㄘㄙ]|[ㄅ-ㄙ]?(?:[ㄧㄨㄩ][ㄚ-ㄦ]?|[ㄚ-ㄦ]))';
const SYLLABLE = new RegExp(`^(?:˙${BODY}|${BODY}[ˊˇˋ]?)$`);
export const isSyllable = (s) => SYLLABLE.test(s);

export const splitReadings = (s) => String(s).trim().split(/\s+/);

// 把一個音拆成直式注音要排的三部分：輕聲的點（排在最上面）、一個一個的符號（由上往下疊）、
// 二三四聲的調號（排在這一欄的右邊）。資料的寫法不變，只在顯示時拆
export function splitSyllable(reading) {
  const chars = [...String(reading || '')];
  return {
    dot: chars.includes('˙'),
    symbols: chars.filter((c) => !'˙ˊˇˋ'.includes(c)),
    tone: chars.find((c) => 'ˊˇˋ'.includes(c)) || '',
  };
}

// 詞句整理成查表用的形狀，長的排前面。同一份資料只整理一次
const prepared = new WeakMap();
function phrasesOf(zhuyin) {
  if (!prepared.has(zhuyin)) {
    const list = Object.entries(zhuyin.phrases || {})
      .map(([key, value]) => ({ chars: [...key], readings: splitReadings(value) }))
      .filter((p) => p.chars.length === p.readings.length) // 讀音數目對不上的不採用
      .sort((a, b) => b.chars.length - a.chars.length);
    prepared.set(zhuyin, list);
  }
  return prepared.get(zhuyin);
}

// 一個字的預設讀音（不看上下文）；查不到是 null
export const defaultReading = (zhuyin, ch) => zhuyin.chars[ch] ?? zhuyin.poly?.[ch] ?? null;

// 回傳和原文一樣長的陣列，一個字一格：漢字是它的讀音，標點（和查不到讀音的字）是 null
export function annotate(raw, zhuyin) {
  const chars = [...String(raw || '')];
  const out = new Array(chars.length).fill(null);
  const phrases = phrasesOf(zhuyin);
  let i = 0;
  while (i < chars.length) {
    const at = i;
    const hit = phrases.find((p) => p.chars.every((ch, k) => chars[at + k] === ch));
    if (hit) {
      hit.readings.forEach((r, k) => { out[at + k] = r; });
      i += hit.chars.length;
    } else {
      if (isHan(chars[i])) out[i] = defaultReading(zhuyin, chars[i]);
      i += 1;
    }
  }
  return out;
}

// 「一」「不」的變調，照國小課本（和行天宮本）的標法：
//   「不」在四聲前面讀二聲（不當 ㄅㄨˊ ㄉㄤˋ）；
//   「一」在四聲前面讀二聲（一日 ㄧˊ ㄖˋ），在一、二、三聲前面讀四聲（一千 ㄧˋ ㄑㄧㄢ）；
//   後面緊接著的不是字（標點、句尾）就讀本調；
//   「一十」的「一」是數字裡十位上的一，讀本調（一十七世 ㄧ ㄕˊ ㄑㄧ ㄕˋ），和「一百」「一千」不同。
// 資料（zhuyin.json）和 annotate() 一律是本調，辭典查證也用本調；變調只在顯示的時候套用。
// 看的是後一個字的本調，回傳新的陣列。
const toneOf = (reading) => [...reading].find((c) => 'ˊˇˋ'.includes(c)) || (reading.startsWith('˙') ? '˙' : '');
export function applySandhi(raw, readings) {
  const chars = [...String(raw || '')];
  return readings.map((reading, i) => {
    const next = readings[i + 1];
    if (!next) return reading;
    const tone = toneOf(next);
    if (chars[i] === '不' && reading === 'ㄅㄨˋ') return tone === 'ˋ' ? 'ㄅㄨˊ' : reading;
    if (chars[i] === '一' && reading === 'ㄧ') {
      if (chars[i + 1] === '十') return reading;
      if (tone === 'ˋ') return 'ㄧˊ';
      return tone === '˙' ? reading : 'ㄧˋ';
    }
    return reading;
  });
}

// 畫面上要顯示的讀音：本調加上「一」「不」的變調
export const annotateForDisplay = (raw, zhuyin) => applySandhi(raw, annotate(raw, zhuyin));
