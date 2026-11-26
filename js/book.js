// 書的資料：載入、頁序、原文處理。這裡的函式都不碰 DOM。
import { MATCH_AFTER } from './config.js';

const DATA = 'js/data';

async function defaultFetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}（${res.status}）`);
  return res.json();
}

export async function loadBook(fetchJson = defaultFetchJson) {
  const [chapters, glossary, daily, match] = await Promise.all([
    fetchJson(`${DATA}/chapters.json`),
    fetchJson(`${DATA}/glossary.json`),
    fetchJson(`${DATA}/daily.json`),
    fetchJson(`${DATA}/match.json`),
  ]);
  return { chapters, glossary, daily, match };
}

// 這一頁的「種子」清單（四個典故、各頁的善行）；其他頁沒有。
// 程式裡沿用《太上感應篇》那本的名字 lamps，畫面上一律稱「種子」
export function lampList(chapter) {
  return chapter.blocks.find((b) => b.type === 'list' && b.role === 'lamps') || null;
}

// 第 part 段的各頁。這本書一頁一段，所以每次都只有一頁；
// 保留這個函式，是因為進度（state.js）以「段」為單位計算
export function partChapters(chapters, part) {
  return chapters.filter((c) => c.part === part);
}

// 有幾段
export function partCount(chapters) {
  return Math.max(...chapters.map((c) => c.part));
}

// 「我的福田」有幾塊田：一段一塊，加上「古今對照」
export function plotCount(chapters) {
  return partCount(chapters) + 1;
}

// 頁名
export function chapterTitle(chapter) {
  return chapter.seq ? `${chapter.title}（${chapter.seq}）` : chapter.title;
}

// 翻頁順序：各頁依序，「古今對照」接在第 MATCH_AFTER 頁後面，最後是「我的福田」
export function pages(chapters) {
  const out = [];
  for (const ch of chapters) {
    out.push(`ch/${ch.no}`);
    if (ch.no === MATCH_AFTER) out.push('match');
  }
  out.push('land');
  return out;
}

// 封面（''）的下一頁是第一頁；不在頁序裡的頁（目錄、每日種福…）沒有上下頁
export function nextRoute(chapters, route) {
  const list = pages(chapters);
  if (route === '') return list[0];
  const i = list.indexOf(route);
  return i < 0 ? null : list[i + 1] ?? null;
}

export function prevRoute(chapters, route) {
  const list = pages(chapters);
  const i = list.indexOf(route);
  if (i < 0) return null;
  return i === 0 ? '' : list[i - 1];
}

// 朗讀用：依 。！？； 斷成一句一句（不用 lookbehind，舊版 Safari 不支援）
export function splitSentences(text) {
  const clean = String(text || '').replace(/[「」『』\s]/g, '');
  return clean.match(/[^。！？；]+[。！？；]?/g) || [];
}

export function chapterRaw(chapter) {
  return chapter.blocks
    .map((b) => (b.type === 'list' ? b.items.map((it) => it.raw).join('') : b.raw))
    .join('');
}
